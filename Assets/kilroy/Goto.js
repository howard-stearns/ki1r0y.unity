// 1. If the gameObject is clicked, smoothly bring the avatar to that object.
//    (Makes no attempt to track an object that moves after being clicked.)
// 2. The above may move the camera. This script brings camera back to head when driving.
// 3. Make the head follow the camera in an appropriate way.

// FIXME: multiple avatars (e.g., animation state per avatar, not per object)
// FIXME: overridable stuff per object (e.g., camera and avatar positioning rules)


public var avatar:Transform;
public var head:Transform;
public var headHeight = 1.0; // Relative to avatar position
public var overlayControls:OverlayControls;
public var scene:Transform;

function Awake() {
	if (avatar == null) avatar = Camera.main.transform.parent;
	if (head == null) head = avatar.Find("Main Camera/Head");
	if (overlayControls == null) overlayControls = GameObject.Find('PlayerOverlay').GetComponent(OverlayControls);
	if (scene == null) scene = GameObject.Find('Scene').transform;
}

// Top level objects or children of group assemblies.
function GetAssemblies(trans:Transform):Array {
	var children = new Array();
	for (var child:Transform in trans) {
		var go = child.gameObject;
		var oc = go.GetComponent(Obj);
		if (oc && !oc.isGroup()) // FIXME remove restriction
			children.push(child);
		//if (child.gameObject.GetComponent(Obj).isGroup()) 
			children = children.Concat(GetAssemblies(child));
	}
	return children;  // FIXME: how shall we sort this?
}

// We keep track of where we are: In a crowded scene, we may be positioned right in front of one object,
// with the avatar actually closer to some object next to the avatar. So if we just look for
// the object closesest to the avatar, we might come up with one that is not the one we are in front of!
public var currentSite:Transform;
function Next() {
	var objs = GetAssemblies(scene);
	var closest:int; 
	var closestDistance:float = Mathf.Infinity;
	// Find the closest assembly to where we are.
	var target = (currentSite == null) ? avatar.position : currentSite.position;
	for (var i:int = 0; i < objs.length; i++) {
		var thisDistance = (target - objs[i].transform.position).magnitude;
		Debug.Log(i.ToString() + ':' + objs[i].ToString() + ' ' + thisDistance + ' closest:'+ closestDistance);
		if (thisDistance < closestDistance) {
			closestDistance = thisDistance;
			closest = i;
		}
	}
	Debug.Log('closest=' + closest + objs.ToString());
	if (++closest >= objs.length) closest = 0;
	Goto(objs[closest]);
}

public var pulseDuration = 0.8;  // The scene's natural period. Animate to next pulse.
var arrivalTime = -1.0;
// If an arrivalTime is set in the future (i.e., not past), Update() will
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
	cameraEndPos = trans.position 
				- (trans.forward * (horizontalMax/2 + Mathf.Max(distByHeight, distByWidth)));
	cameraEndRot = Quaternion.LookRotation(trans.position - cameraEndPos);
}

// Setup avatar's start/end position/rotation so that after animation, the avatar
// will "fall" just slightly into a stable position on the floor. The horizontal 
// positioning along the floor might be based on seating or on multiple people
// shoulder-to-shoulder, or otherwise just a vertical line through the camera.
function setupAvatarAnimation(trans:Transform) {
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
	
	var endFacing = trans.position - avatarEndPos;
	endFacing.y = 0;   // Don't tilt the avatar
	avatarEndRot = Quaternion.LookRotation(endFacing);
}

enum GotoState {
	None,
	Transporting,
	FallingAtObjectAfterArrival,
	AtObject,
	ResumedDriving
}
var state = GotoState.None;

function Goto(trans:Transform) {
	currentSite = trans;
	setupCameraAnimation(trans);
	setupAvatarAnimation(trans);
	arrivalTime = Time.time + pulseDuration;
	state = GotoState.Transporting;	
	overlayControls.trackMouseMotion(false);
	head.parent = avatar; // So that it doesn't move up or down with camera until AtObject.
}

//function OnMouseUpAsButton () { Goto(transform); }

private var lastVertical:float;
function Update() {
	if (Input.GetKeyDown(KeyCode.Tab)) Next();
	switch (state) {
	case GotoState.Transporting:
		if (Time.time < arrivalTime) {
			var delta = 1 - ((arrivalTime - Time.time)/pulseDuration);
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
	// Falling occurs during FixedUpdate
	case GotoState.AtObject:
		// We don't trackMouseMotion AtObject, because we generally want to
		// see whatever we're at without mouse-look. (This is also convenient
		// programming-wise, because the head is in a different position and orientation
		// from the camera.)
		// However, we do have to notice when we start moving.
		if (Input.GetAxis("Horizontal") || Input.GetAxis("Vertical")) {
			state = GotoState.ResumedDriving;
			currentSite = null;
			arrivalTime = Time.time + pulseDuration;
			// local coords because avatar is moving
			cameraStartPos = Camera.main.transform.localPosition ;
			cameraEndPos = Vector3.up * headHeight;  
			cameraStartRot = Quaternion.identity;
			/* old code that skips the ResumedDriving state.
			state = GotoState.None;
			Camera.main.transform.position = avatar.position + (Vector3.up * headHeight);
			Camera.main.transform.LookAt(transform);
			head.parent = Camera.main.transform; // So it tracks motion normally.
			head.localRotation = Quaternion.identity; */
			overlayControls.trackMouseMotion(true); 
		} 
		break;
	}
}
function FixedUpdate() {
	switch (state) {
	case GotoState.FallingAtObjectAfterArrival:
		Camera.main.transform.position = cameraEndPos; // Keep camera in position as we fall
		if (avatar.position.y < lastVertical) { // Might not change during Update()
			lastVertical = avatar.position.y;
		} else { // First observation that we're no longer falling.
			state = GotoState.AtObject;
		}
		break;
	}
}
function LateUpdate() {
	switch (state) {
	case GotoState.ResumedDriving:
		if (Time.time < arrivalTime) {
			delta = 1 - ((arrivalTime - Time.time)/pulseDuration);
			Camera.main.transform.localPosition = Vector3.Lerp(cameraStartPos, cameraEndPos, delta);
			// MouseLook script will try to unsmoothly slam camera rotation during
			// normal (not Late) Update():
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