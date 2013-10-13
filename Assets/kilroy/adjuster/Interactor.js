#pragma strict

class Interactor extends MonoBehaviour {
	// The most basic interactive behavior for a Kilroy Obj:
	// * Efficiently does nothing unless we've been made active with OnMouseEnter (and no OnMouseExit).
	// * Acts on an assembly (defaults to our grandparent during Start):
	//   1. If active and mouse down, raycast against affordanceCollider (defaults to our collider during Start), and send StartDragging.
	//   2. Send resetCast and doDragging zero or more times while mouse is moved.
	//   3. Send stopDragging on mouse up.
	//   During this, public var isMoving is true, otherwise false.
	// FIXME: lock out all other Interactors while isMoving.


public var assembly:Transform;  // The object to be transformed.
public var affordanceCollider:Collider; // We raycast against this to start things offs.

function Start() {
	affordanceCollider = transform.collider;
	assembly = transform.parent.parent;
}

private var isActive = false;
function OnMouseEnter () {
	if (assembly.parent && (assembly.parent.name == 'GridTarget')) return; // Already dragging by someone (not necessarilly this axis).  // FIXME!
	isActive = true;
}
function OnMouseExit () {
	isActive = false;
}

function startDragging(assembly:Transform, cameraRay:Ray, hit:RaycastHit)  {
	throw "Subclass must define to set initial plane position and rotation.";
	// answers true IFF the drag can be handled (e.g., not aligned with camera)
}
function resetCast(hit:RaycastHit[]):boolean {
	throw "Subclass must define to update hit[0] and return true to indicate success (and continued dragging), else false.";
}
function doDragging(assembly:Transform, hit:RaycastHit) {
	throw "Subclass must define to update plane position and rotation.";
}
function stopDragging(assembly:Transform) {
	throw "Subclass must define to include any side effects, such as saving the scene.";
}

public var isMoving = false; // In the processing of being dragged around.
function startDragging1(cameraRay:Ray, hit:RaycastHit) {
	isMoving = true;
	startDragging(assembly, cameraRay, hit);
}
function stopDragging1() {
	if (!isMoving) return;
	isMoving = false;	
	stopDragging(assembly);
}

function Update() {
	var hit = new RaycastHit[1];
	if (isActive && Input.GetMouseButtonDown(0)) {
		var cameraRay = Camera.main.ScreenPointToRay(Input.mousePosition);
		if (!affordanceCollider.Raycast(cameraRay, hit[0], Mathf.Infinity)) {
			stopDragging1(); return;
		}
		startDragging1(cameraRay, hit[0]);
		return;
	} 	
	if (!isMoving 
			|| Input.GetMouseButtonUp(0)
			|| !resetCast(hit)) { // side-effect is new hit.point for doDragging
		stopDragging1(); return;
	}
	doDragging(assembly, hit[0]);
}
}