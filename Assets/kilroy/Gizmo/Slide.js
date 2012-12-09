class Slide extends Directional {
var firstPoint:Vector3;
// Project p onto axis. i.e., we don't care about being to the side of the axis.
function constrain(axis:Transform, p:Vector3):Vector3 {
	var vNormalized = axis.right;
	var dot = Vector3.Dot(vNormalized, p - firstPoint);  // Use Vector3.Project instead?
	var proj = dot * vNormalized;
	return firstPoint + proj;
}
function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit) {
	plane.rotation = Quaternion.LookRotation(axis.right, -cameraRay.direction);
	plane.position = firstPoint = hit.point;
	return plane.collider;
}

function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	plane.position = constrain(axis, hit.point);
}
}