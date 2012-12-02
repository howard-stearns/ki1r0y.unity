public var fullBrightColor = Color.red;
public var color:Color;

// Update() checks on mouse down for any intersection with our collider.
// There are multiple affordances, but OnMouseEnter will only fire for one
// at a time, so isActive guards against multiple scripts firing.
var isActive = false;
function OnMouseEnter () {
	Debug.Log('enter');
	isActive = true;
    renderer.material.color = fullBrightColor;
}
function OnMouseExit () {
	Debug.Log('leave');  
	isActive = false;
	// FIXME: don't exit if isMoving, and then do exit on mouse up. (For all three scripts.)
    renderer.material.color = color;
}

public var assembly:Transform;
public var axis:Transform;
function Awake() {
	axis = transform.parent;
	color = fullBrightColor / 1.33;
	renderer.material.color = color;
	assembly = axis.parent.parent;
}
var isMoving = false;
var plane:GameObject;
var firstPoint:Vector3;
function stopDragging() {
	if (!isMoving) return;
	assembly.parent = plane.transform.parent;
	plane.transform.parent = null;
	Destroy(plane);
	isMoving = false;
}
function constrain(p:Vector3):Vector3 {
	var vNormalized = axis.right;
	var dot = Vector3.Dot(vNormalized, p - firstPoint);  // Use Vector3.Project instead?
	var proj = dot * vNormalized;
	return firstPoint + proj;
}
function Update() {
	var hit:RaycastHit;
	if (isActive && Input.GetMouseButtonDown(0)) {
		var cameraRay = Camera.main.ScreenPointToRay(Input.mousePosition);
		if (!collider.Raycast(cameraRay, hit, Mathf.Infinity)) {
			stopDragging();
			return;
		}
		isMoving = true;
		plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
		plane.renderer.enabled = false;
		plane.transform.rotation = Quaternion.LookRotation(axis.right, -cameraRay.direction);
		firstPoint = plane.transform.position = hit.point;
		plane.transform.parent = assembly.parent;
		assembly.parent = plane.transform;
	}
	if (Input.GetMouseButtonUp(0)) {
		stopDragging();
		return;
	}
	if (!isMoving) return;
	if (!plane.collider.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition), hit, Mathf.Infinity)) {
		stopDragging();
		return;
	}
	plane.transform.position = constrain(hit.point);
}
