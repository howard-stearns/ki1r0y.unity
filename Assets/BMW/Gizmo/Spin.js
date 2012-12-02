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
var firstPoint:Vector3; // Let's change this name to clickPoint.
var firstAngle:float;
function stopDragging() {
	if (!isMoving) return;
	assembly.parent = plane.transform.parent;
	plane.transform.parent = null;
	Destroy(plane);
	isMoving = false;
}

function constrain(p:Vector3):Vector3 {
	return p;
}
var assemblyIndex:int;
function setAssemblyIndex() { // Assumes we're in some orthogonal orientation!
	var inAssembly = assembly.InverseTransformDirection(axis.up);
	var i; var biggest = 0;
	for (i = 0; i < 3; i++) {
		if (inAssembly[i] > biggest) {assemblyIndex = i; biggest = inAssembly[i];}
	}
}
public var showPlane = false;
function Update() {
	var hit:RaycastHit;
	if (isActive && Input.GetMouseButtonDown(0)) {
		var cameraRay = Camera.main.ScreenPointToRay(Input.mousePosition);
		if (!collider.Raycast(cameraRay, hit, Mathf.Infinity)) {
			stopDragging();
			return;
		}
		isMoving = true;
		setAssemblyIndex();
		plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
		plane.renderer.enabled = showPlane;
		// ** 
		var norm = axis.right; //** assign this
		if (Vector3.Dot(cameraRay.direction, norm) > 0)  norm = -norm;
		plane.transform.rotation = Quaternion.LookRotation(axis.up, norm); //**
		firstPoint = plane.transform.position = hit.point;
		Debug.Log('firstPoint=' + firstPoint.ToString());
		var originRay = Ray(transform.position + norm, -norm); // Adjust for our orientation.
		if (!plane.collider.Raycast(originRay, hit, Mathf.Infinity))
			Debug.Log('WTF?');
		plane.transform.position = hit.point;  // We want to rotate around the shaft, not the firstPoint.
		Debug.Log('centered=' + hit.point.ToString());
		Debug.Log('cyclinder center=' + transform.position.ToString());
		Debug.Log('firstAngle:' + firstAngle.ToString());
		plane.transform.parent = assembly.parent;
		assembly.parent = plane.transform;
		firstAngle = 90; //assembly.localEulerAngles.y; 
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
	var startV = firstPoint - plane.transform.position; //**
	var v = hit.point - plane.transform.position;
	var cross = Vector3.Cross(startV, v);
	var dot = Vector3.Dot(cross, axis.right);
	var angle = Vector3.Angle(startV, v); 
	if (dot < 0) angle = -1 * angle;
	Debug.DrawRay(plane.transform.position, startV, Color.green);
	Debug.DrawRay(plane.transform.position, v, Color.blue);
	Debug.DrawRay(plane.transform.position, cross, Color.white);
	Debug.Log(cross.ToString() + ' ' + dot.ToString() + ' ' + angle.ToString());
	assembly.localEulerAngles.y = firstAngle + angle;  
	/*switch (assemblyIndex) {
	case 0: assembly.localEulerAngles.x = firstAngle + angle; break;                                                                                                                                 
	case 1: assembly.localEulerAngles.y = firstAngle + angle; break;                                                                                                                                 
	case 2: assembly.localEulerAngles.y = firstAngle + angle; break; 
	} */                                                                                                                             
}
