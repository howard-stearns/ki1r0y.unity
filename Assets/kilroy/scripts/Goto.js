// Automates and animates the positioning of an avatar at an object.
// (Attach this script to an avatar.)
// 1. If the gameObject is clicked, smoothly bring the avatar to that object.
//    (Makes no attempt to track an object that moves after being clicked.)
// 2. The above may move the camera. This script brings camera back to head when driving.
// 3. Make the head follow the camera in an appropriate way.

// FIXME: overridable stuff per object (e.g., camera and avatar positioning rules)


public var avatar:Transform;  	// The avatar to control.
public var head:Transform;		// That avatar's head object. Follows mouse when mouse look is enabled.
public var headHeight = 1.0; 	// Relative to avatar position
public var overlayControls:OverlayControls;		// The script on the PlayerOverlay that controls mouse look.
public var scene:Transform;	    // The head of that part of the scene graph that defines each Kilroy Obj we can goto.

function Awake() { // Initialize the above.
	if (avatar == null) avatar = Camera.main.transform.parent;
	if (head == null) head = avatar.Find("Main Camera/Head");
	if (overlayControls == null) overlayControls = GameObject.Find('/PlayerOverlay').GetComponent(OverlayControls);
	if (scene == null) scene = GameObject.FindWithTag('SceneRoot').transform; // By tag, because it could be called anything.
}

// Answer a list of each Kilroy Obj we can goto.
// Called for each goto, so the members/order should be stable unless things have really changed.
// An assembly is currently either a toplevel Obj in scene, or else 
// Top level objects or children of group assemblies.
function GetAssemblies(trans:Transform):Array {
	var assemblies = new Array();
	for (var child:Transform in trans) {
		var go = child.gameObject;
		var oc = go.GetComponent.<Obj>();
		if (oc && oc.isTargetable()) {
			assemblies.push(child);
			if (oc.isGroup()) 
				assemblies = assemblies.Concat(GetAssemblies(child));
		}
	}
	return assemblies;  // FIXME: how shall we sort this?
}
public function GetRelated() {
	var objs = GetAssemblies(scene);
	var data = new Array();
	var root = GameObject.FindWithTag('SceneRoot').GetComponent.<Obj>();
	var sceneNametag = root.nametag;
	for (var i:int = 0; i < objs.length; i++) {
		var obj = objs[i].gameObject.GetComponent(Obj);
		data.push({
			'objectIdtag': obj.hash, 'objectNametag': obj.nametag, 
			'sceneNametag': sceneNametag, 'timestamp': obj.timestamp,
			'userIdtag': obj.author});
	}
	Application.ExternalCall('setRelated', JSON.Stringify(data));
}

// We keep track of where we are: In a crowded scene, we may be positioned right in front of one object,
// with the avatar actually closer to some object next to the avatar. So if we just look for
// the object closest to the avatar, we might come up with one that is not the one we are in front of!
public var currentSite:Transform;
// Find the assembly we're at (or closest to), and goto the next one.
public function Next(isForward:boolean) {
	var objs = GetAssemblies(scene);
	var closest:int; 
	var closestDistance:float = Mathf.Infinity;
	// Find the closest assembly to where we are. If we're not at an assembly, we still want
	// to go to the next one after whatever happens to be closest. For example, we don't want 
	// tabbing to keep taking us back to the closest. Similarly, if the assemblies are milling
	// around a bit.
	var target = (currentSite == null) ? avatar.position : currentSite.position;
	for (var i:int = 0; i < objs.length; i++) {
		var thisDistance = (target - objs[i].transform.position).magnitude;
		//Debug.Log(i.ToString() + ':' + objs[i].ToString() + ' ' + thisDistance + ' closest:'+ closestDistance);
		if (thisDistance < closestDistance) {
			closestDistance = thisDistance;
			closest = i;
		}
	}
	//Debug.Log('closest=' + closest + ' among ' + objs);
	if (isForward) {
		if (++closest >= objs.length) closest = 0;
	} else {
		if (--closest < 0) closest = objs.length-1;
	}
	Goto(objs[closest], true);
}
public function Next(isForward:String) { // For testing from browser.
	Next(isForward=="true");
}

public var pulseDuration = 0.8;  // The scene's natural period. Animate to next pulse.
// FIXME: Current implementation animates over exactly pulseDuration, regardless of whether
// the Goto() happens on "a beat". It would be nice if an animationDuration varied so that 
// animationEndTime would end on the scene's global beat.
var animationEndTime = -1.0;	// If in the future, it is the expected time any animation will end.
// If an animationEndTime is set in the future (i.e., not past), Update() will
// animate the camera and avatar between their respect start/end position/rotations.
var cameraStartPos:Vector3;
var cameraEndPos:Vector3;
var cameraStartRot:Quaternion;
var cameraEndRot:Quaternion;
var avatarStartPos:Vector3;
var avatarEndPos:Vector3;
var avatarStartRot:Quaternion;
var avatarEndRot:Quaternion;

// Setup camera's start/end position/rotation so that the camera will be centered
// on the object, at a distance so that the object fills the camera frustrum.
function setupCameraAnimation(obj:Obj) {
	cameraStartPos = Camera.main.transform.position;
	cameraStartRot = Camera.main.transform.rotation;
	
	//cameraEndPos = trans.position - (trans.forward * 2); // simplifed version of the following
	var trans = obj.transform;
	cameraEndPos = trans.position;
	var bounds = obj.bounds();
	var size = bounds.size; // BoundingBox in world space alignment
	var vertical = size.y;  // Global y is right, but add a margin.
	if (vertical && size.x) { // guard to not blow up
		var horizontalMax = Vector3(size.x, size.z, 0).magnitude; // regardless of orientation 
		var distByHeight = vertical / 
			(2 * Mathf.Tan(Mathf.Deg2Rad * Camera.main.fieldOfView/2));
		var distByWidth = horizontalMax /
			(2 * Mathf.Tan(Mathf.Deg2Rad * Camera.main.fieldOfView*Camera.main.aspect/2));
		var facing = trans.TransformDirection(obj.localFacing);
		cameraEndPos += (facing * (horizontalMax/2 + Mathf.Max(distByHeight, distByWidth)));
		cameraEndRot = Quaternion.LookRotation(trans.position - cameraEndPos);
	} else { // e.g., if no collider or size
		cameraEndPos += Vector3.up; // A slight overview, and not, e.g,, in the ground
		camerEndRot = Quaternion.LookRotation(Vector3.forward);
	}
}

// Setup avatar's start/end position/rotation so that after animation, the avatar
// will "fall" just slightly into a stable position on the floor. The horizontal 
// positioning along the floor is currently based on a vertical line through the camera,
// but in principle it could be based on seating or on multiple people shoulder-to-shoulder.
function setupAvatarAnimation(objectPosition:Vector3) {
	avatarStartPos = avatar.position;
	avatarStartRot = avatar.rotation;
	
	var hit:RaycastHit;
	var pointerRay = Ray(cameraEndPos, -Vector3.up);
	// FIXME: Do not intersect with yourself.
	// FIXME: Do intersect with other avatars and move over.
	if (!Physics.Raycast(pointerRay, hit)) {
		Debug.LogError("No floor?");
	} else {
		var offset = Vector3.up * avatar.lossyScale.y * 1.1;
		avatarEndPos = hit.point + offset;
	}
	
	var endFacing = objectPosition - avatarEndPos;
	endFacing.y = 0;   // Don't tilt the avatar
	avatarEndRot = Quaternion.LookRotation(endFacing);
}

enum GotoState {  	// The ordered states we go through.
	None,			// Not associated with any particular assembly.
	Transporting,	// We've started to goto someplace, but aren't there yet.
	FallingAtObjectAfterArrival,  	// We're there, but still falling to the floor
	AtObject,		// Stable after arrival.
	ResumedDriving	// We've just started driving and are still smoothly animating the camera back to where it belongs.
}
var state = GotoState.None; 	// This avatar's current state.

// Goto the specified object, automating and animating the avatar/camera that we are attached to.
// The current implementation goes to a fixed position/orientation based on where the assembly is
// now, but in principle it could track moving assemblies.
function Goto(trans:Transform, addToHistory:boolean) {
	var obj = trans.gameObject.GetComponent(Obj);
	/*Application.ExternalCall('notifyUser', 
		'Goto ' + trans + ' current=' + (currentSite || 'none')
		+ (addToHistory ? " addToHistory" : " suppressHistory"));*/
	obj.ExternalPropertyEdit('metadata', addToHistory && (trans != currentSite));
	if (trans == currentSite) {
		trans.parent.gameObject.SendMessage("Wrap", trans.gameObject, SendMessageOptions.DontRequireReceiver);
		//trans.gameObject.GetComponent(PictureDrawing).Wrap(trans.parent.gameObject);
		//Wrap(trans.gameObject, trans.parent.gameObject);
		return;
	}
	currentSite = trans;
	setupCameraAnimation(obj);
	setupAvatarAnimation(trans.position);
	animationEndTime = Time.time + pulseDuration;
	state = GotoState.Transporting;	
	overlayControls.lockMouseMotionOff();
	head.parent = avatar; // So that it doesn't move up or down with camera until AtObject.
}
function GoBackTo(id:String) { // From browser back button.
	GoBackToObj(id && GameObject.Find(id));
}
function GoBackToObj(go:GameObject) {
	Application.ExternalCall('notifyUser', 'GoBackTo ' + go);
	if (!go) {  // initial scene re-entry, or somehow deleted
		currentSite = null;
		var start = transform.position;
		var end = Vector3(0, 1, 0);
		for (var t = 0.0; t < 1; t += Time.deltaTime / 0.8) {
			transform.position = Vector3.Lerp(start, end, t);
			yield;
		}
		Obj.SceneSelect(); // we used to force here (argument of true). necessary?
		return;
	}
	currentSite = null; // e.g., user picks current from history. Don't interpret as wrap.
	Goto(go.transform, false);
}

// The scene root could be called anything, which means we can't send a browser message
// to it (as we don't know it's scene-graph path). That's ok, though because we can figure 
// that out from here (in Unity).
function RestoreScene(spec:String) {
	scene.gameObject.GetComponent(Restore).RestoreScene(spec);
}


private var lastVertical:float; // Z position while FallingAtObjectAfterArrival.
// Check for tab key, driving AtObject, and animate Transporting.
function Update() {
	if (Input.GetKeyDown(KeyCode.Tab)) 
		Next(!(Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift)));
	switch (state) {
	case GotoState.Transporting:
		if (Time.time < animationEndTime) {
			var delta = 1 - ((animationEndTime - Time.time)/pulseDuration);
			avatar.position = Vector3.Lerp(avatarStartPos, avatarEndPos, delta);
			avatar.rotation = Quaternion.Lerp(avatarStartRot, avatarEndRot, delta);
			Camera.main.transform.position = Vector3.Lerp(cameraStartPos, cameraEndPos, delta);
			Camera.main.transform.rotation = Quaternion.Lerp(cameraStartRot, cameraEndRot, delta);
		} else {
			avatar.position = avatarEndPos;
			avatar.rotation = avatarEndRot;
			Camera.main.transform.position = cameraEndPos;
			Camera.main.transform.rotation = cameraEndRot;
			state = GotoState.FallingAtObjectAfterArrival;
			lastVertical = Mathf.Infinity;
		}
		break;
	// See FixedUpdate for FallingAtObjectAfterArrival.
	case GotoState.AtObject:
		// We don't trackMouseMotion AtObject, because we generally want to
		// see whatever we're at without mouse-look. (This is also convenient
		// programming-wise, because the head is in a different position and orientation
		// from the camera.)
		// However, we do have to notice when we start moving.
		if (Input.GetAxis("Horizontal") || Input.GetAxis("Vertical")) {
			state = GotoState.ResumedDriving;
			currentSite = null;
			animationEndTime = Time.time + pulseDuration;
			// local coords because avatar is moving
			cameraStartPos = Camera.main.transform.localPosition ;
			cameraEndPos = Vector3.up * headHeight;  
			cameraStartRot = Quaternion.identity;
			overlayControls.trackMouseMotion(true); 
		} 
		break;
	// See LateUpdate for ResumedDriving.
	}
}
// Keep watch during FallingAtObjectAfterArrival so we can go to next state.
// Falling (avatar.position.y) is changed during FixedUpdate, not Update.
function FixedUpdate() {
	switch (state) {
	case GotoState.FallingAtObjectAfterArrival:
		Camera.main.transform.position = cameraEndPos; // Keep camera in position as we fall
		if (avatar.position.y < lastVertical) { 
			lastVertical = avatar.position.y;
		} else { // First observation that we're no longer falling.
			// Regardless of why we're going, shut down any existing highlight, but
			// don't unselect it. That will keep it from re-highliting when we move the mouse
			// around over the object, but still select if we move the mouse over different objects.
			gameObject.GetComponent(Select).UnHighlight();
			state = GotoState.AtObject;
		}
		break;
	}
}
// During ResumedDriving, animate the return of the camera to position within the head.
// MouseLook script will try to unsmoothly slam camera rotation during normal (not Late) Update():
function LateUpdate() {
	switch (state) {
	case GotoState.ResumedDriving:
		if (Time.time < animationEndTime) {
			delta = 1 - ((animationEndTime - Time.time)/pulseDuration);
			Camera.main.transform.localPosition = Vector3.Lerp(cameraStartPos, cameraEndPos, delta);
			var lookRot = Camera.main.transform.localRotation;
			Camera.main.transform.localRotation =  // smooth it
				Quaternion.Lerp(cameraStartRot, lookRot, delta);
		} else {
			Camera.main.transform.localPosition = cameraEndPos;
			head.parent = Camera.main.transform; // So it tracks motion normally.
			head.localRotation = Quaternion.identity; 
			state = GotoState.None;
		}
		break;
	}
}
