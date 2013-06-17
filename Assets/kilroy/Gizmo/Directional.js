class Directional extends MonoBehaviour {
public var highlightColor:Color;		// defaults to red/green/blue for x/y/z
public var normalColor:Color;  	// defaults to a muted version of highlighColor
public var assembly:Transform;  // The object to be transformed.
public var planeName = 'GridTarget';
// Update() checks on mouse down for ANY intersection with our collider.
// There are multiple affordances, but OnMouseEnter will only fire for one
// at a time, so isActive guards against multiple scripts firing.
private var isActive = false; // Hot, highlighted.
private var isMoving = false; // In the processing of being dragged around.
function OnMouseEnter () {
	//Debug.Log('enter');
	if (assembly.parent && (assembly.parent.name == planeName)) return; // Already dragging by someone (not necessarilly this axis).
	isActive = true;
	if (!isMoving) renderer.material.color = highlightColor;
}
function OnMouseExit () {
	//Debug.Log('leave');  
	isActive = false;
	if (isMoving) return;
    renderer.material.color = normalColor;
}
// The transform for this directional. E.g., there may be slide/stretch/spin gameObjects 
// (that have a subclass of this script attached), which are all arranged into a composite
// gameObject associated with either the local x, y, or z axis of an object. That composite
// is the 'axis'.
public var axis:Transform; 
public var targetAlpha:float = 0.9;
function Start() {
	axis = transform.parent;
	if (highlightColor == Color.clear) {
		// A pun: axis.right is 1,0,0 for x axis, and so is red. Similarly for y/green and z/blue.
		var colorVector:Vector4 = axis.parent.InverseTransformDirection(axis.right);
		colorVector.w = targetAlpha;
		highlightColor = colorVector;
	}
	if (normalColor == Color.clear) normalColor = highlightColor / 1.33;
	renderer.material.color = normalColor;
	//renderer.material.SetColor("_Emission", normalColor); // In case the scene is dark.
	if (assembly == null) assembly = axis.parent.parent;
}
public static function ApplyChanges(assy:Transform):Obj {
	var pobj = assy.GetComponent.<Obj>();
	pobj.size(Vector3.Scale(pobj.size(), assy.localScale));
	assy.localScale = Vector3.one;
	return pobj;
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
	plane.renderer.enabled = showPlane;
	plane.name = planeName;
	dragCollider = startDragging(assembly, axis, plane.transform, cameraRay, hit);
	plane.transform.parent = assembly.parent;
	//assembly.parent = plane.transform;
}
function stopDragging() {
	if (!isMoving) return;
	renderer.enabled = true; // In case of mouse up when the last doDragging() turned it off.
	//assembly.parent = plane.transform.parent;
	plane.transform.parent = null;
	Destroy(plane);
	isMoving = false;
	if (!isActive) renderer.material.color = normalColor;
	ApplyChanges(assembly).saveScene('adjust');
}
function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit):Collider  {
	throw "Subclass must define to set initial plane position and rotation.";
	// answers true IFF the drag can be handled (e.g., not aligned with camera)
}
function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	throw "Subclass must define to update plane position and rotation.";
}
function Update() {
	var hit:RaycastHit;
	// FIXME: If the plane would be parallel to the camera, we should disable gameObject.renderer,
	// so that no one is tempted to try to use the affordance when it cannot possibly work.
	
	if (isActive && Input.GetMouseButtonDown(0)) {
		var cameraRay = Camera.main.ScreenPointToRay(Input.mousePosition);
		if (!collider.Raycast(cameraRay, hit, Mathf.Infinity)) {
			stopDragging(); return;
		}
		startDragging1(cameraRay, hit);
		return;
	} 	
	if (!isMoving 
			|| Input.GetMouseButtonUp(0)
			// Find hit.point such where the mouse intersects the plane.
			|| !dragCollider.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition), hit, Mathf.Infinity)) {
		stopDragging(); return;
	}
	doDragging(assembly, axis, plane.transform, hit);
}
}