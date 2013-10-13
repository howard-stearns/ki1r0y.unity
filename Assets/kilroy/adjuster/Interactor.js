#pragma strict

class Interactor extends MonoBehaviour {
	// The most basic interactive behavior for a Kilroy Obj:
	// * Efficiently does nothing unless we've been made active with OnMouseEnter (and no OnMouseExit).
	//   If ANY Interactor is active, no others will be.
	// * Acts on an assembly (defaults to our grandparent during Start):
	//   1. If active and mouse down, raycast against affordanceCollider (defaults to our collider during Start), and send startDragging.
	//   2. Send resetCast and doDragging zero or more times while mouse is moved.
	//   3. Send stopDragging on mouse up.
	//   During this, public var isMoving is true, otherwise false.
	// * startDragging() may answer a Laser Script Component (else null), in which case it is sent StartInteraction/UpdateInteraction/EndInteraction.
	// The affordanceCollider should really match the shape of the affordance (e.g., a Mesh collider rather than capsule collider
	// for a cylinder mesh), because people will be mousing it.
	// If the gizmo is added to the HUD layer, the scene should have a HUD Camera attached to the Main Camera.


public var assembly:Transform;  // The object to be transformed.
function updateAssembly(assy:Transform) { assembly = assy; }   // In case of transfer to a copy.
public var affordanceCollider:Collider; // We raycast against this to start things offs.
function Start() {
	affordanceCollider = transform.collider;
	updateAssembly(transform.parent.parent);
}

// Update() checks on mouse down for ANY intersection with our collider.
// There are multiple affordances, but OnMouseEnter will only fire for one
// at a time, so isActive guards against multiple scripts firing.
public static var AnyActive = false;
public var isActive = false;
function OnMouseEnter () {
	if (AnyActive) return; // Someone is already active (not necessarilly this axis). 
	isActive = true;
	AnyActive = true;
}
function OnMouseExit () {
	isActive = false;
	AnyActive = false;
}

function startDragging(assembly:Transform, cameraRay:Ray, hit:RaycastHit):Laser  {
	throw "Subclass must define to set initial plane position and rotation.";
	// answers true IFF the drag can be handled (e.g., not aligned with camera)
}
function resetCast(hit:RaycastHit[]):boolean { // Unityscript cannot side-effect a RaycastHit, hence wrapped in an array of one.
	throw "Subclass must define to update hit[0] and return true to indicate success (and continued dragging), else false.";
}
function doDragging(assembly:Transform, hit:RaycastHit) {
	throw "Subclass must define to update plane position and rotation.";
}
function stopDragging(assembly:Transform) {
	throw "Subclass must define to include any side effects, such as saving the scene.";
}

public var isMoving = false; // In the processing of being dragged around.
public var laser:Laser;
function startDragging1(cameraRay:Ray, hit:RaycastHit) {
	isMoving = true;
	laser = startDragging(assembly, cameraRay, hit);
	if (laser != null) { laser.StartInteraction(hit.point, assembly); }
}
function stopDragging1() {
	if (!isMoving) return;
	isMoving = false;	
	stopDragging(assembly);
	if (laser != null) { laser.EndInteraction(); }
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
	if (laser != null) { laser.UpdateInteraction(hit[0].point); }
}
}