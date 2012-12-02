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
var firstScale:float;
function stopDragging() {
	if (!isMoving) return;
	assembly.parent = plane.transform.parent;
	plane.transform.parent = null;
	Destroy(plane);
	isMoving = false;
}
function constrain(p:Vector3):Vector3 {
	var vNormalized = axis.right;
	var dot = Vector3.Dot(vNormalized, p - firstPoint);
	var proj = dot * vNormalized;
	return firstPoint + proj;
}
var assemblyIndex:int;
function setAssemblyIndex() { // Assumes we're in some orthogonal orientation!
	var xInAssembly = assembly.InverseTransformDirection(axis.right);
	var i; var biggest = 0;
	for (i = 0; i < 3; i++) {
		if (xInAssembly[i] > biggest) {assemblyIndex = i; biggest = xInAssembly[i];}
	}
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
		setAssemblyIndex();
		plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
		plane.renderer.enabled = false;
		plane.transform.rotation = Quaternion.LookRotation(axis.right, -cameraRay.direction);
		firstPoint = plane.transform.position = hit.point;
		firstScale = assembly.localScale[assemblyIndex]; 
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
	// Note: This only works if the the stretcher (and therefere, any possible firstPoint) is past the end of the slider. (why?) 
	var v = constrain(hit.point);  //** etc.
	var d = (v - assembly.position).magnitude;
	var d0 = (firstPoint - assembly.position).magnitude;
	var s = (d/d0) * firstScale;
	/*Too lossy
	var worldScale = assembly.TransformDirection(assembly.localScale);
	var localScale = transform.InverseTransformDirection(worldScale);
	localScale.x = s;
	var adjustedWorldScale = transform.TransformDirection(localScale);
	assembly.localScale = assembly.InverseTransformDirection(adjustedWorldScale);*/
	// Unity bug? v[0] = val is supposed to work, but doesn't.
	switch (assemblyIndex) {
	case 0: assembly.localScale.x = s; break;
	case 1: assembly.localScale.y = s; break;
	case 2: assembly.localScale.z = s; break;
	}
	//assembly.localScale[0] = s; //adjust for our orientation
	Debug.Log('d:' + d.ToString() + ' d0:' + d0.ToString() + ' s:' + s.ToString() + assembly.localScale.ToString());
}
