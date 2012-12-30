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

function Awake() {
	if (avatar == null) avatar = Camera.main.transform.parent;
	if (head == null) head = avatar.Find("Main Camera/Head");
	if (overlayControls == null) overlayControls = GameObject.Find('PlayerOverlay').GetComponent(OverlayControls);
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
function setupCameraAnimation() {
	cameraStartPos = Camera.main.transform.position;
	cameraStartRot = Camera.main.transform.rotation;
	
	//cameraEndPos = transform.position - (transform.forward * 2);
	var size = renderer.bounds.size; // BoundingBox in world space alignment
	var vertical = size.y;  // Global y is right, but add a margin.
	var horizontalMax = Vector3(size.x, size.z, 0).magnitude; // regardless of orientation 
	var distByHeight = vertical / 
		(2 * Mathf.Tan(Mathf.Deg2Rad * Camera.main.fieldOfView/2));
	var distByWidth = horizontalMax /
		(2 * Mathf.Tan(Mathf.Deg2Rad * Camera.main.fieldOfView*Camera.main.aspect/2));
	cameraEndPos = transform.position 
				- (transform.forward * (horizontalMax/2 + Mathf.Max(distByHeight, distByWidth)));
	cameraEndRot = Quaternion.LookRotation(transform.position - cameraEndPos);
}

// Setup avatar's start/end position/rotation so that after animation, the avatar
// will "fall" just slightly into a stable position on the floor. The horizontal 
// positioning along the floor might be based on seating or on multiple people
// shoulder-to-shoulder, or otherwise just a vertical line through the camera.
function setupAvatarAnimation() {
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
	
	var endFacing = transform.position - avatarEndPos;
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

function OnMouseUpAsButton () {
	setupCameraAnimation();
	setupAvatarAnimation();
	arrivalTime = Time.time + pulseDuration;
	state = GotoState.Transporting;	
	overlayControls.trackMouseMotion(false);
	head.parent = avatar; // So that it doesn't move up or down with camera until AtObject.
}

private var lastVertical:float;
function Update() {
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
			arrivalTime = Time.time + pulseDuration;
			// local coords because avatar is moving
			cameraStartPos = Camera.main.transform.localPosition ;
			cameraEndPos = Vector3.up * headHeight;  
			cameraStartRot = Quaternion.identity;
			/*
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