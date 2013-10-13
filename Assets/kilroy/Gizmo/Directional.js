class Directional extends Interactor {
	// An Interactor for affordances that act in a single plane during the drag. 
	// By default, the affordances on the axis associated with this direction/plane are color coded.
	// The affordance GameObject should have:
	// * a (e.g., Mesh) Renderer. (Probably don't need to cast or receive shadows.) The renderer can be in a child if setColor() is defined there.
	// * a transparent/vertex-lit material. (Kilroy uses the Materials/translucent.)
	// The affordance should be a child of an axis assembly (that has any number of affordances).
	// The (typicall three or six) axis assemblies are children of something -- let's call it a gizmo -- that is attached as a child of the assembly 
	// that is being moved around (which must have an Obj component to ApplyChanges).

function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit):Collider  {
	throw "Subclass must define to set initialize drag, and optionally to adjust hit.point.";
}
function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	throw "Subclass must define to update assembly position and rotation.";
}

public var highlightColor:Color;	// defaults to red/green/blue for x/y/z
public var normalColor:Color;  		// defaults to a muted version of highlighColor
// This is broadcast to gameObject and children. Thus children of affordances can change color if they define this message.
public function setColor(color:Color) { if (renderer) { renderer.material.color = color; } }
public function setAffordanceColor(color:Color) { BroadcastMessage('setColor', color, SendMessageOptions.DontRequireReceiver); }
function OnMouseEnter() {	
	super.OnMouseEnter();
	if (!isMoving) { setAffordanceColor(highlightColor); }
}
function OnMouseExit() {
	super.OnMouseExit();  
	if (!isMoving) { setAffordanceColor(normalColor); }
}

// The transform for this directional. E.g., there may be slide/stretch/spin gameObjects 
// (that have a subclass of this script attached), which are all arranged into a composite
// gameObject associated with either the local x, y, or z axis of an object. That composite
// is the 'axis'.
public var axis:Transform; 
public var targetAlpha:float = 0.9;
function Start() {
	super.Start(); 
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


// While moving, we insert a plane into the scene graph, just above the assembly.
public var showPlane = false;
private var plane:GameObject;
private var dragCollider:Collider;  // Returned by startDragging. Usually the plane.collider, but OnEdge Spinners answer the collider we're attached to.
function startDragging(assembly:Transform, cameraRay:Ray, hit:RaycastHit):Laser {
	plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
	plane.renderer.enabled = showPlane;
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
	if (!isActive) { setAffordanceColor(normalColor); }
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