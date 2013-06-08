class Stretch extends Directional {
private var firstPoint:Vector3;
private var firstScale:float;
function constrain(axis:Transform, p:Vector3):Vector3 {
	var vNormalized = axis.right;
	var dot = Vector3.Dot(vNormalized, p - firstPoint);
	var proj = dot * vNormalized;
	return firstPoint + proj;
}
private var assemblyIndex:int;
function setAssemblyIndex(assembly:Transform, axis:Transform) { // Assumes we're in some orthogonal orientation!
	var xInAssembly = assembly.InverseTransformDirection(axis.right);
	var i; var biggest = 0;
	for (i = 0; i < 3; i++) {
		if (xInAssembly[i] > biggest) {assemblyIndex = i; biggest = xInAssembly[i];}
	}
}
function startDragging(assembly:Transform, axis:Transform, plane:Transform, cameraRay:Ray, hit:RaycastHit) {
	plane.rotation = Quaternion.LookRotation(axis.right, -Camera.main.transform.forward);
	plane.position = firstPoint = hit.point;
	setAssemblyIndex(assembly, axis);
	firstScale = assembly.localScale[assemblyIndex];
	return plane.collider;
}


function doDragging(assembly:Transform, axis:Transform, plane:Transform, hit:RaycastHit) {
	// Note: This only works if the the stretcher (and therefere, any possible firstPoint) is past the end of the slider. (why?) 
	var v = constrain(axis, hit.point);  //** etc.
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
	//Debug.Log('d:' + d.ToString() + ' d0:' + d0.ToString() + ' s:' + s.ToString() + assembly.localScale.ToString());
}
}