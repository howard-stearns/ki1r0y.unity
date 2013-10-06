class Adjust extends Directional {

static function projectPointOnPlane(point, planeNormal, planePoint) {
	return point - (planeNormal * Vector3.Dot(planeNormal, point - planePoint));
}
// divide each component of n by d. If d component is zero, use defaultComponent.
static function div(n:Vector3, d:Vector3, defaultComponent:float) {
	return Vector3(d.x ? n.x / d.x : defaultComponent,
					d.y ? n.y / d.y : defaultComponent,
					d.z ? n.z / d.z : defaultComponent);
}
static function noFlip(scale:Vector3) { // Make sure that scale doesn't flip
	return Vector3(Mathf.Abs(scale.x), Mathf.Abs(scale.y), Mathf.Abs(scale.z));
}

// These are in global coordinates
var centerPlaneFirstCorner:Vector3; 
var firstPoint:Vector3;
// These are in our coordinate system.
var firstAffordanceLocalPosition:Vector3;
var firstAffordanceLocalScale:Vector3;

function updateAffordance() { //As we scale assembly during movement, invert that to keep affordance at constant size in corners.
	affordanceCollider.transform.localPosition = div(firstAffordanceLocalPosition, noFlip(axis.localRotation * assembly.localScale), 1);
	//affordanceCollider.transform.localScale = div(firstAffordanceLocalScale, Vector3(assembly.localScale.y, 1, assembly.localScale.z), 1);
	affordanceCollider.transform.localScale = div(firstAffordanceLocalScale, noFlip(axis.localRotation * affordanceCollider.transform.localRotation * assembly.localScale), 1);
}

function Start() {
	super.Start();
	var aff = transform.Find('affordance');
	affordanceCollider = aff.collider;
	firstLocalPosition = transform.localPosition;
	firstAffordanceLocalPosition = aff.localPosition;
	firstAffordanceLocalScale = aff.localScale;
//	centerPlaneFirstCorner = projectPointOnPlane(transform.position, axis.right, axis.position);
//	Debug.Log(transform.parent + ' rotated:' + (axis.localRotation * aff.localRotation * Vector3(1, 2, 3)));
}
function Update() {
	super.Update();
	updateAffordance();
}

function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit) {
	plane.rotation = affordanceCollider.transform.rotation;
	plane.position = transform.position;
	firstPoint = hit.point;
	centerPlaneFirstCorner = (projectPointOnPlane(transform.position, axis.right, axis.position) - axis.position);
	Debug.Log('hit:' + (hit.point * 10) + ' corner:' + (transform.position * 10) + ' centerPlane:' + (centerPlaneFirstCorner * 10));
	return plane.collider;
}
/*
	At the start of a drag, each assembly axis has a scale of 1. (See Directional.ApplyChanges().)
	For each assembly axis during a resizing drag, with o = assembly origin, s = starting extremity, n = new:
   	o        s  n
   	Scale = n/s.     (We should construct things so that s cannot be zero.)
*/
function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	var pointerDelta = hit.point - firstPoint;
	var newCorner = centerPlaneFirstCorner + pointerDelta;
	var ratio = div(newCorner, centerPlaneFirstCorner, 1.0);
	assembly.localScale = noFlip(Quaternion.Inverse(axis.localRotation) * ratio); 
//	Debug.Log('hit:' + (hit.point * 10) + ' delta:' + (pointerDelta * 10) + ' new:' + (newCorner * 10) + ' ratio:' + (ratio * 10) + ' scale:' + (assembly.localScale * 10));
//	updateAffordance();
//	v = Vector3.Scale(assembly.localScale, assembly.GetComponent.<Obj>().size());
//	Application.ExternalCall('updateSize', v.x, v.y, v.z);
}
function resetAffordance(assy:Transform) {
	//transform.localPosition = Vector3.Scale(transform.localPosition, assy.localScale);
	transform.localPosition = Vector3.Scale(transform.localPosition, noFlip(axis.localRotation * assy.localScale));
}
function stopDragging(assy:Transform):Obj{
	axis.parent.BroadcastMessage('resetAffordance', assy, SendMessageOptions.DontRequireReceiver);
	return super.stopDragging(assy);
//	var s = assy.localScale;
//	var o = super.stopDragging(assy);
//	transform.localPosition = Vector3.Scale(transform.localPosition, s);
//	updateAffordance();
//	return o;
}
}