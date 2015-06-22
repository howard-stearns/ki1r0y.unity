class Directional extends ColorInteractor {
	// An Interactor for affordances that act in a single plane during the drag. 
	// By default, the affordances on the axis associated with this direction/plane are color coded.
	// The affordance should be a child of an axis assembly (that has any number of affordances).
	// The (typicall three or six) axis assemblies are children of something -- let's call it a gizmo -- that is attached as a child of the assembly 
	// that is being moved around (which must have an Obj component to ApplyChanges).

function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit):Collider  {
	throw "Subclass must define to set initialize drag, and optionally to adjust hit.point.";
}
function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	throw "Subclass must define to update assembly position and rotation.";
}

// The transform for this directional. E.g., there may be slide/stretch/spin gameObjects 
// (that have a subclass of this script attached), which are all arranged into a composite
// gameObject associated with either the local x, y, or z axis of an object. That composite
// is the 'axis'.
public var axis:Transform; 
function Awake() {
	//Debug.Log('set ' + transform + ' axis to ' + transform.parent);
	axis = transform.parent;
	if (highlightColor == Color.clear) {
		// A pun: axis.right is 1,0,0 for x axis, and so is red. Similarly for y/green and z/blue.
		var rgb = axis.parent.InverseTransformDirection(axis.right);
		
		// We can modify this to fit our pallet:
		if (Mathf.Abs(Vector3.Dot(rgb, Vector3.right)) > 0.5) rgb = Vector3(0.596, 0.227, 0.349); // red triad of FB blue
		else if (Mathf.Abs(Vector3.Dot(rgb, Vector3.up)) > 0.5) rgb = Vector3(0.349, 0.596, 0.227); // green trial of FB blue
		else rgb = Vector3(0.231, 0.349, 0.596); // FB blue.
		
		highlightColor = makeAlpha(rgb);
	}
	super.Awake(); 
	updateAssembly(axis.parent.parent);
}


// While moving, we insert a plane into the scene graph, just above the assembly.
public var showPlane = false;
private var plane:GameObject;
private var dragCollider:Collider;  // Returned by startDragging. Usually the plane.collider, but OnEdge Spinners answer the collider we're attached to.
function startDragging(assembly:Transform, cameraRay:Ray, hit:RaycastHit):Laser {
	plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
	plane.GetComponent.<Renderer>().enabled = showPlane;
	dragCollider = startDragging(assembly, axis, plane.transform, cameraRay, hit);
	plane.transform.parent = assembly.parent;
	return null;
}
function resetCast(hit:RaycastHit[]) {
	return dragCollider.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition), hit[0], Mathf.Infinity);
}
function doDragging(assembly:Transform, hit:RaycastHit) { doDragging(assembly, axis, plane.transform, hit); }
function stopDragging(assy:Transform) {
	dragCollier = null;
	plane.transform.parent = null;
	Destroy(plane);
	if (!isActive) { setAffordanceColor(normalColor); } // do we need this? for safety?
	ApplyChanges(assy).saveScene('adjust');
}
// Non-unit scales are terrible to work with in assemblies. (Descendant parts fly apart when we rotate them.)
// So (extendible) stopDragging() does ApplyChanges, which sets Obj.size() and resets scale to 1.
public static function ApplyChanges(assy:Transform):Obj {
	var pobj = assy.GetComponent.<Obj>();
	pobj.size(Vector3.Scale(pobj.size(), assy.localScale));
	assy.localScale = Vector3.one;
	return pobj;
}
}