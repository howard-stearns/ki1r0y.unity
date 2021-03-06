class Spin extends Directional {

private var centerPoint:Vector3;
private var firstPoint:Vector3; // Let's change this name to clickPoint.
private var startV:Vector3;
public var outsideAngle:float = 90;
public var insideAngle:float = -90;
private var initAngle:float;
private var isOutside:boolean;
private var norm:Vector3;
private var onEdge:boolean;

function Awake() {
	super.Awake();
	var zDot = Vector3.Dot(Vector3(0, 0, 1), axis.parent.InverseTransformDirection(axis.right));
	if (zDot > 0.9) {
		outsideAngle = 180;
		insideAngle = 0;
		//Debug.Log('We are Z: ' + axis + ' ' + zDot);
	}
}

private var lastAngle = 0.0;
function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit) {
	norm = axis.right; 
	// There are two distinct modes: we can click on the outside-or-inside face of the disk, 
	// or we can click on the edge of the disk (because we're too edge-on to effectively spin the face).
	onEdge = Mathf.Abs(Vector3.Dot(norm, hit.normal)) < 0.9;
	plane.position = firstPoint = hit.point;
	isOutside = Vector3.Dot(cameraRay.direction, norm) < 0; // i.e., looking down the norm, against the arrow towards the origin
	if (!isOutside)  norm = -norm;
	plane.rotation = Quaternion.LookRotation(axis.up, norm); 
	var originRay = Ray(transform.position + norm, -norm); // Adjust for our orientation.
	if (!plane.GetComponent.<Collider>().Raycast(originRay, hit, Mathf.Infinity))
		Debug.Log('WTF?');
	centerPoint = plane.position = hit.point;  // We want to rotate around the shaft, not the firstPoint.
	startV = firstPoint - plane.position;
	lastAngle = initAngle = isOutside ? outsideAngle : insideAngle;
	return onEdge ? GetComponent.<Collider>() : plane.GetComponent.<Collider>();
}

function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	var v = hit.point - centerPoint;
	// There are two ways that a person can drag things such that the results are not
	// stable, depending on whether we're onEdge. If so, make the disk invisible to cue the user.
	if (onEdge 
		? (Mathf.Abs(Vector3.Dot(hit.normal, norm)) > 0.9999) // shifted onto disk face
		: (v.sqrMagnitude < 0.00025)) {// too close to rotation point
		GetComponent.<Renderer>().enabled = false;  
		return;
	}
	GetComponent.<Renderer>().enabled = true;
	var cross = Vector3.Cross(startV, v);
	var dot = Vector3.Dot(cross, norm); 
	var angle = Vector3.Angle(startV, v); 
	if (dot < 0) angle = -1 * angle; 
	Debug.DrawRay(centerPoint, startV, Color.green);
	Debug.DrawRay(centerPoint, v, Color.blue);
	Debug.DrawRay(centerPoint, cross, Color.white);
	assembly.transform.RotateAround(centerPoint, norm, initAngle + angle - lastAngle);
	lastAngle = initAngle + angle;
	//assembly.localEulerAngles.y = initAngle + angle; 
	v = assembly.localEulerAngles;
	Application.ExternalCall('updateRotation', v.x, v.y, v.z);
}
function stopDragging(assy:Transform) {
	GetComponent.<Renderer>().enabled = true; // In case of mouse up when the last doDragging() turned it off.
	super.stopDragging(assy);
}
}