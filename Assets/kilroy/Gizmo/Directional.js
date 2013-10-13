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
public var assembly:Transform;  // The object to be transformed.
public var planeName = 'GridTarget';
// Update() checks on mouse down for ANY intersection with our collider.
// There are multiple affordances, but OnMouseEnter will only fire for one
// at a time, so isActive guards against multiple scripts firing.
private var isActive = false; // Hot, highlighted.
private var isMoving = false; // In the processing of being dragged around.

// This is broadcast to gameObject and children. Thus children of affordances can change color if they define this message.
public function setColor(color:Color) { if (renderer) { renderer.material.color = color; } }
public function setAffordanceColor(color:Color) { BroadcastMessage('setColor', color, SendMessageOptions.DontRequireReceiver); }
function OnMouseEnter () {	
	//Debug.Log('enter');
	if (assembly.parent && (assembly.parent.name == planeName)) return; // Already dragging by someone (not necessarilly this axis).
	isActive = true;
	if (!isMoving) { setAffordanceColor(highlightColor); }
}
function OnMouseExit () {
	//Debug.Log('leave');  
	isActive = false;
	if (isMoving) return;
    setAffordanceColor(normalColor);
}
// The transform for this directional. E.g., there may be slide/stretch/spin gameObjects 
// (that have a subclass of this script attached), which are all arranged into a composite
// gameObject associated with either the local x, y, or z axis of an object. That composite
// is the 'axis'.
public var axis:Transform; 
public var targetAlpha:float = 0.9;
public var affordanceCollider:Collider; // Subclasses can extend Start to let this be a child's collider.
function Start() {
	affordanceCollider = collider;
	axis = transform.parent;
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
	if (assembly == null) assembly = axis.parent.parent;
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
// Returned by startDragging. 
// Usually the plane.collider, but OnEdge Spinners answer the collider we're attached to.
private var dragCollider:Collider; 
function startDragging1(cameraRay:Ray, hit:RaycastHit) {
	isMoving = true;
	plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
	//plane.transform.localScale = Vector3(0.1, 0.1, 0.1); // when desired for debugging.
	plane.renderer.enabled = showPlane;
	plane.name = planeName;
	dragCollider = startDragging(assembly, axis, plane.transform, cameraRay, hit);
	plane.transform.parent = assembly.parent;
	//assembly.parent = plane.transform;
}
function stopDragging1() {
	if (!isMoving) return;
	dragCollier = null;
	isMoving = false;
	//assembly.parent = plane.transform.parent;
	plane.transform.parent = null;
	Destroy(plane);
	if (!isActive) { setAffordanceColor(normalColor); }
	stopDragging(assembly).saveScene('adjust');
}
function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit):Collider  {
	throw "Subclass must define to set initial plane position and rotation.";
	// answers true IFF the drag can be handled (e.g., not aligned with camera)
}
function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	throw "Subclass must define to update plane position and rotation.";
}

function doDragging(assembly:Transform, hit:RaycastHit) { doDragging(assembly, axis, plane.transform, hit); }
function Update() {
	var hit = new RaycastHit[1];
	// FIXME: If the plane would be parallel to the camera, we should disable gameObject.renderer,
	// so that no one is tempted to try to use the affordance when it cannot possibly work.
	
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
			// Find hit.point where the mouse intersects the plane.
			|| !dragCollider.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition), hit[0], Mathf.Infinity)) {
		stopDragging1(); return;
	}
	doDragging(assembly, hit[0]);
}
}