class Directional extends MonoBehaviour {
	// Subclass this and attach it to a shape to act as an affordance.
	// The affordance GameObject should have:
	// * a (e.g., Mesh) Renderer. (Probably don't need to cast or receive shadows.) The renderer can be in a child if setColor() is defined there.
	// * a Collider that matches the shape (e.g., a Mesh collider rather than capsule collider for a cylinder mesh), because people will be mousing it.
	// * a transparent/vertex-lit material. (Kilroy uses the Materials/translucent.)
	// The affordance should be a child of an axis assembly (that has any number of affordances).
	// The (typicall three or six) axis assemblies are children of something -- let's call it a gizmo -- that is attached as a child of the assembly 
	// that is being moved around (which must have an Obj component to ApplyChanges).
	// If the gizmo is added to the HUD layer, the scene should have a HUD Camera attached to the Main Camera.
public var highlightColor:Color;		// defaults to red/green/blue for x/y/z
public var normalColor:Color;  	// defaults to a muted version of highlighColor
public var planeName = 'GridTarget';

// This is broadcast to gameObject and children. Thus children of affordances can change color if they define this message.
public function setColor(color:Color) { if (renderer) { renderer.material.color = color; } }
public function setAffordanceColor(color:Color) { BroadcastMessage('setColor', color, SendMessageOptions.DontRequireReceiver); }
function OnMouseEnterXX () {	
	//super.OnMouseEnter();
	if (!isMoving) { setAffordanceColor(highlightColor); }
}
function OnMouseExitXX () {
	//super.OnMouseExit();  
	if (isMoving) return;
    setAffordanceColor(normalColor);
}

// The transform for this directional. E.g., there may be slide/stretch/spin gameObjects 
// (that have a subclass of this script attached), which are all arranged into a composite
// gameObject associated with either the local x, y, or z axis of an object. That composite
// is the 'axis'.
public var axis:Transform; 
public var targetAlpha:float = 0.9;
function StartXX() {
	// super.Start(); 
	//affordanceCollider = collider;
	axis = transform.parent;
	assembly = axis.parent.parent;
	if (highlightColor == Color.clear) {
		// A pun: axis.right is 1,0,0 for x axis, and so is red. Similarly for y/green and z/blue.
		var rgb = axis.parent.InverseTransformDirection(axis.right);
		
		// We can modify this to fit our pallet:
		if (Vector3.Dot(rgb, Vector3.right) > 0.5) rgb = Vector3(0.596, 0.227, 0.349); // red triad of FB blue
		else if (Vector3.Dot(rgb, Vector3.up) > 0.5) rgb = Vector3(0.349, 0.596, 0.227); // green trial of FB blue
		else rgb = Vector3(0.231, 0.349, 0.596); // FB blue.
		
		var colorVector:Vector4 = rgb;
		colorVector.w = targetAlpha;
		highlightColor = colorVector;
	}
	if (normalColor == Color.clear) normalColor = highlightColor / 1.33;
	setAffordanceColor(normalColor);
	//renderer.material.SetColor("_Emission", normalColor); // In case the scene is dark.
}
// Non-unit scales are terrible to work with in assemblies. (Descendant parts fly apart when we rotate them.)
// So (extendible) stopDragging() does ApplyChanges, which sets Obj.size() and resets scale to 1.
public static function ApplyChanges(assy:Transform):Obj {
	var pobj = assy.GetComponent.<Obj>();
	pobj.size(Vector3.Scale(pobj.size(), assy.localScale));
	assy.localScale = Vector3.one;
	return pobj;
}
function stopDragging(assy:Transform):Obj {
	return ApplyChanges(assy);
}

// While moving, we insert a plane into the scene graph, just above the assembly.
public var showPlane = false;
private var plane:GameObject;
function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit):Collider  {
	throw "Subclass must define to set initial plane position and rotation.";
	// answers true IFF the drag can be handled (e.g., not aligned with camera)
}
function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	throw "Subclass must define to update plane position and rotation.";
}

function doDragging(assembly:Transform, hit:RaycastHit) { doDragging(assembly, axis, plane.transform, hit); }
function resetCast(hit:RaycastHit[]) {
	return dragCollider.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition), hit[0], Mathf.Infinity);
}

private var dragCollider:Collider;  // Returned by startDragging. Usually the plane.collider, but OnEdge Spinners answer the collider we're attached to.
function startDragging(assembly:Transform, cameraRay:Ray, hit:RaycastHit) {
	plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
	plane.renderer.enabled = showPlane;
	plane.name = planeName;
	dragCollider = startDragging(assembly, axis, plane.transform, cameraRay, hit);
	plane.transform.parent = assembly.parent;
}
function stopDraggingXX() {
	// super.stopDragging1();
	dragCollier = null;
	plane.transform.parent = null;
	Destroy(plane);
	if (!isActive) { setAffordanceColor(normalColor); }
	stopDragging(assembly).saveScene('adjust');
}

private var isActive = false;
function OnMouseEnter () {
	if (Interactor.AnyActive) return; // Someone is already active (not necessarilly this axis). 
	isActive = true;
	Interactor.AnyActive = true;
	OnMouseEnterXX();
}
function OnMouseExit () {
	isActive = false;
	Interactor.AnyActive = false;
	OnMouseExitXX();
}
public var assembly:Transform;  // The object to be transformed.
public var affordanceCollider:Collider; // We raycast against this to start things offs.
function Start() {
	affordanceCollider = transform.collider;
	assembly = transform.parent.parent;
	StartXX();
}
public var isMoving = false; // In the processing of being dragged around.
function startDragging1(cameraRay:Ray, hit:RaycastHit) {
	isMoving = true;
	startDragging(assembly, cameraRay, hit);
}
function stopDragging1() {
	if (!isMoving) return;
	isMoving = false;	
	stopDraggingXX();
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