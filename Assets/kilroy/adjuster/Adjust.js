class Adjust extends Directional {

// Not used. divide each component of n by d. If d component is zero, use defaultComponent. 
static function div(n:Vector3, d:Vector3, defaultComponent:float) {
	return Vector3(d.x ? n.x / d.x : defaultComponent,
					d.y ? n.y / d.y : defaultComponent,
					d.z ? n.z / d.z : defaultComponent);
}
static function projectPointOnPlane(point, planeNormal, planePoint) {
	return point - (planeNormal * Vector3.Dot(planeNormal, point - planePoint));
}
static function noFlip(scale:Vector3) { // Make sure that scale doesn't flip
	return Vector3(Mathf.Abs(scale.x), Mathf.Abs(scale.y), Mathf.Abs(scale.z));
}

var assemblyObj:Obj;
// These are in our coordinate system.
public var cornerUnitPositionFromAxis:Vector3;
public var flipX = false;
function updateAffordance() { //As we resize assembly during movement, keep affordance at constant size in new corners.
	var pos = Vector3.Scale(cornerUnitPositionFromAxis, axis.localRotation * assemblyObj.size());
	// I don't know why this needs adjusting, but it does.
	if (flipX) { pos.x = -pos.x; }
	transform.localPosition = pos;
}
function Start() {
	super.Start();
	flipX = Vector3.Dot(axis.right, assembly.right) < 0.2;
	assemblyObj = assembly.gameObject.GetComponent.<Obj>();
	affordanceCollider = transform.Find('affordance').collider;
}
public var doRotate = false;
public var doShift = false;
public var lastRotationV:Vector3;
public var rotationCenter:Vector3;
// In world coordinates.
public var firstPoint:Vector3;
public var startCorner:Vector3;      // The "corner" offset to a plane (parallel to the interaction plane) that runs through the middle of the assembly.
public var oppositeCorner:Vector3;   // The opposite "corner" (on that same middle plane).
public var orthogonalCorner:Vector3; // Not really a corner, it extends a half width past the startCorner in the middle. Length is the assembly dimension perpendicular to plane.
function resetParameters(p:Vector3, force:boolean) {
	var rotate = !!Input.GetAxis('Fire2');
	var shift = Input.GetKey(KeyCode.LeftShift);
	if (force || (rotate != doRotate) || (shift != doShift)) {
		doRotate = rotate;
		doShift = shift;
		firstPoint = p;
		startCorner = projectPointOnPlane(transform.position, axis.right, axis.position);
		oppositeCorner = shift ? (axis.position - (startCorner - axis.position)) : assembly.position;
		if (rotate) {
			Debug.Log('doRotate:' + doRotate + ' shift:' + shift);
			rotationCenter = shift ? projectPointOnPlane(oppositeCorner, axis.right, axis.position) : assembly.position;
			lastRotationV = p - rotationCenter;
		} else {
			orthogonalCorner = Vector3.Project(assemblyObj.size(), assembly.InverseTransformDirection(axis.right));
		}
	}
}

function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit) {
	plane.rotation = affordanceCollider.transform.rotation;
	plane.position = transform.position;
	resetParameters(hit.point, true);
	return plane.collider;
}
function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	resetParameters(hit.point, false);
	if (doRotate) {
		var v = hit.point - rotationCenter; 
		var angle = Vector3.Angle(lastRotationV, v);
		// but angle is always the smallest positive value. We need to determine direction...
		var cross = Vector3.Cross(lastRotationV, v);
		if (Vector3.Dot(cross, axis.right) < 0.0) { angle = -1 * angle; }
		assembly.transform.RotateAround(rotationCenter, axis.right, angle);
		lastRotationV = v;
	} else {
		var pointerDelta = hit.point - firstPoint;
		var newCorner = startCorner + pointerDelta;
		var span = newCorner - oppositeCorner;
		if (doShift) { 
			assembly.position = (newCorner + oppositeCorner) / 2;
		} else {
			span *= 2;

		}
		assemblyObj.size(noFlip(assembly.InverseTransformDirection(span) + orthogonalCorner));
	}
	assembly.BroadcastMessage('updateAffordance', null, SendMessageOptions.DontRequireReceiver);
}
}