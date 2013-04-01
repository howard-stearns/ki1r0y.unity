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
		var oc = go.GetComponent(Obj);
		if (oc && oc.renderer!=null)
			assemblies.push(child);
		if (child.gameObject.GetComponent(Obj).isGroup()) 
			assemblies = assemblies.Concat(GetAssemblies(child));
	}
	return assemblies;  // FIXME: how shall we sort this?
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
		Debug.Log(i.ToString() + ':' + objs[i].ToString() + ' ' + thisDistance + ' closest:'+ closestDistance);
		if (thisDistance < closestDistance) {
			closestDistance = thisDistance;
			closest = i;
		}
	}
	Debug.Log('closest=' + closest + ' among ' + objs);
	if (isForward) {
		if (++closest >= objs.length) closest = 0;
	} else {
		if (--closest < 0) closest = objs.length-1;
	}
	Goto(objs[closest], true);
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
function setupCameraAnimation(trans:Transform) {
	cameraStartPos = Camera.main.transform.position;
	cameraStartRot = Camera.main.transform.rotation;
	
	//cameraEndPos = trans.position - (trans.forward * 2); // simplifed version of the following
	var size = trans.renderer.bounds.size; // BoundingBox in world space alignment
	var vertical = size.y;  // Global y is right, but add a margin.
	var horizontalMax = Vector3(size.x, size.z, 0).magnitude; // regardless of orientation 
	var distByHeight = vertical / 
		(2 * Mathf.Tan(Mathf.Deg2Rad * Camera.main.fieldOfView/2));
	var distByWidth = horizontalMax /
		(2 * Mathf.Tan(Mathf.Deg2Rad * Camera.main.fieldOfView*Camera.main.aspect/2));
	var obj = trans.GetComponent(Obj);
	var facing = obj ? trans.TransformDirection(obj.localFacing) : -trans.forward;
	cameraEndPos = trans.position 
				+ (facing * (horizontalMax/2 + Mathf.Max(distByHeight, distByWidth)));
	cameraEndRot = Quaternion.LookRotation(trans.position - cameraEndPos);
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

function DescribeMesh(o:GameObject) {  // For debugging.
	var m = o.GetComponent(MeshFilter).mesh;
	var min = m.bounds.center - m.bounds.extents;
	var max = m.bounds.center + m.bounds.extents;
	//Debug.Log('bounds: ' + m.bounds.size + ' @' + m.bounds.center);
	//Debug.Log('min:' + min + ' max:' + max);
	/*for (var i = 0; i < m.vertexCount; i++) {
		var uv = m.uv[i];
		if ((uv == Vector2(0, 0)) || (uv == Vector2(1, 1))) {
			Debug.Log('' + i + ': ' + m.vertices[i] + ' => ' + m.uv[i]);
		}
	}*/	
	Debug.Log('world min:' + o.transform.TransformPoint(min) + ' max:' + o.transform.TransformPoint(max));
}

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
	setupCameraAnimation(trans);
	setupAvatarAnimation(trans.position);
	animationEndTime = Time.time + pulseDuration;
	state = GotoState.Transporting;	
	overlayControls.lockMouseMotionOff();
	head.parent = avatar; // So that it doesn't move up or down with camera until AtObject.
}
function GoBackTo(id:String) { // From browser back button.
	var go = GameObject.Find(id);
	if (!go) {  // initial scene entry, or somehow deleted
		var start = transform.position;
		var end = Vector3(0, 1, 0);
		for (var t = 0.0; t < 1; t += Time.deltaTime / 0.8) {
			transform.position = Vector3.Lerp(start, end, t);
			yield;
		}
		return;
	}
	//Application.ExternalCall('notifyUser', 'GoBackTo ' + id + ' ' + go);
	Goto(go.transform, false);
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

/*function Wrap(picture:GameObject, obj:GameObject) {
	
	var pm = picture.GetComponent(MeshFilter).mesh;
	var p1 = picture.transform.TransformPoint(pm.bounds.center - pm.bounds.extents);
	var p2 = picture.transform.TransformPoint(pm.bounds.center + pm.bounds.extents);
	var pNNormal =  -picture.transform.up;
	Debug.Log('p1:' + p1 + ' p2:' + p2);
	var hit1:RaycastHit; var hit2:RaycastHit;
	if (obj.collider.Raycast(Ray(p1 - pNNormal, pNNormal), hit1, Mathf.Infinity)) {
		Debug.Log('p1 hit:' + hit1.point + ' normal:' + hit1.normal + ' uv:' + hit1.textureCoord);
	} else Debug.LogError('No p1 hit');
	if (obj.collider.Raycast(Ray(p2 - pNNormal, pNNormal), hit2, Mathf.Infinity)) {
		Debug.Log('p2 hit:' + hit2.point + ' normal:' + hit2.normal + ' uv:' + hit2.textureCoord);
	} else Debug.LogError('No p1 hit');

	var minU = Mathf.Min(hit1.textureCoord.x, hit2.textureCoord.x);
	var minV = Mathf.Min(hit1.textureCoord.y, hit2.textureCoord.y);
	var maxU = Mathf.Max(hit1.textureCoord.x, hit2.textureCoord.x);
	var maxV = Mathf.Max(hit1.textureCoord.y, hit2.textureCoord.y);
	var scale = Vector2(1/(maxU - minU), 1/(maxV - minV));
	var offset = Vector2(minU, minV);
	// I'm not sure why the -1 is necessary: maybe because planes are left handed, but uv space is not.
	var offsetScaled = Vector2(scale.x * offset.x * -1, scale.y * offset.y * -1);
	Debug.Log('scale: ' + scale + ' offset:' + offset 
			+ ' scale.x:' + scale.x + ' scale.y:' + scale.y 
			+ ' offset.x:' + offset.x + ' offset.y' + offset.y
			+ ' offsetScaled:' + offsetScaled);
	obj.renderer.material.mainTexture = picture.renderer.material.mainTexture;
	obj.renderer.material.mainTextureScale = scale;
	obj.renderer.material.mainTextureOffset = offsetScaled;
	Debug.Log('after scale: ' + scale + ' offset:' + offset + ' offsetScaled:' + offsetScaled); 
	Debug.Log('textur scale: ' + obj.renderer.material.mainTextureScale + ' offset:' + obj.renderer.material.mainTextureOffset); 
}*/