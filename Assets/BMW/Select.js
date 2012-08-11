var cam:Camera;

function Awake () {
	cam = Camera.main;
}

private var oldColor:Color;

function Highlight(obj:GameObject) {
	oldColor = obj.renderer.material.color;
	obj.renderer.material.color = Color.green;
}

function UnHighlight(obj:GameObject) {
	obj.renderer.material.color = oldColor;
}


public var selected:Collider;

function Select(col:Collider) {
	UnSelect();
	selected = col;
	Highlight(selected.gameObject);
}

function UnSelect() {
	if (selected) {
		UnHighlight(selected.gameObject);
		selected = null;
	}
}

public var isDragging:boolean = false;
public var lastDragPosition:Vector3;
public var offset:Vector3 = Vector3.zero;
public var savedLayer:int;
public var laserPrefab:Transform;
public var laser:GameObject;
public var shoulder:Transform;

function between(verticalObject, p1, p2, width) {
	var offset:Vector3 = (p1 - p2) / 2.0;
	verticalObject.transform.position = p1 - offset;
	verticalObject.transform.up = p2 - p1;
	verticalObject.transform.localScale = Vector3(width, offset.magnitude, width);
}

function StopDragging() {
	isDragging = false;
	if (selected) {
		selected.gameObject.layer = savedLayer;
		var pivot = selected.gameObject.transform.parent;
		Debug.Log("go=" + selected.gameObject + " pivot=" + pivot + " parent=" + (pivot ? pivot.parent : null));
		selected.gameObject.transform.parent = pivot.parent;
		Destroy(pivot.gameObject);
	}
	Screen.showCursor = true;
	offset = Vector3.zero;
	Destroy(laser);
}

function hitNormal(hit:RaycastHit) {
	// Just in case, also make sure the collider also has a renderer material and texture 
   	var meshCollider = hit.collider as MeshCollider; 
   	if (meshCollider == null || meshCollider.sharedMesh == null) {
       	return hit.normal; 
	}
   	var mesh : Mesh = meshCollider.sharedMesh; 
   	var normals = mesh.normals; 
   	var triangles = mesh.triangles; 

   	// Extract local space normals of the triangle we hit 
   	var n0 = normals[triangles[hit.triangleIndex * 3 + 0]]; 
   	var n1 = normals[triangles[hit.triangleIndex * 3 + 1]];    
   	var n2 = normals[triangles[hit.triangleIndex * 3 + 2]];    
    
   	// interpolate using the barycentric coordinate of the hitpoint 
   	var baryCenter = hit.barycentricCoordinate; 

   	// Use barycentric coordinate to interpolate normal 
   	var interpolatedNormal = n0 * baryCenter.x + n1 * baryCenter.y + n2 * baryCenter.z; 
   	// normalize the interpolated normal 
   	interpolatedNormal =  interpolatedNormal.normalized; 
    
   	// Transform local space normals to world space 
   	var hitTransform : Transform = hit.collider.transform; 
   	interpolatedNormal = hitTransform.TransformDirection(interpolatedNormal); 

   	return interpolatedNormal;
}

public var pivotPrefab:Transform;
function Update () {
    var hit:RaycastHit;
    var pointerRay:Ray;
    var laserStart:Vector3 = shoulder.position;
    pointerRay = cam.ScreenPointToRay (Input.mousePosition + offset);
	if (Physics.Raycast(pointerRay, hit)) {
		if (Input.GetMouseButtonDown(0)) {
			Debug.Log("down");
			isDragging = true;
			var obj:GameObject = hit.collider.gameObject;
			savedLayer = obj.layer;
			obj.layer = 2; //Ignore Raycast layer.
			Screen.showCursor = false;
			if (!Physics.Raycast(hit.point, Vector3.down, hit)) Debug.Log("WTF?");
			laser = Instantiate(laserPrefab.gameObject);
			between(laser, laserStart, hit.point, 0.05);
			laser.transform.parent = gameObject.parent;
			var contact:Vector3 = cam.WorldToScreenPoint(hit.point);
			contact.z = 0;
			offset = contact - Input.mousePosition;
			lastDragPosition = hit.point;
			var pivot = Instantiate(pivotPrefab, hit.point, selected.transform.rotation);
			Debug.Log("selected=" + selected + " parent=" + selected.transform.parent + " pivot=" + pivot);
			pivot.parent = selected.transform.parent;
			selected.transform.parent = pivot;
			Debug.Log("now selected=" + selected + " parent=" + selected.transform.parent);
			Debug.Log("mouse=" + Input.mousePosition + " contact=" + contact + " offset=" + offset);
		} else if (Input.GetMouseButtonUp(0)) {
			Debug.Log("up");
			StopDragging();
		} else if (isDragging) {
			var delta = hit.point - lastDragPosition;
			if (!selected) {
				StopDragging();
				return;
			}		
			lastDragPosition = hit.point;
			between(laser, laserStart, hit.point, 0.1);
			var trans:Transform = selected.transform.parent;
			trans.Translate(delta, Space.World);
			var norm:Vector3 = hitNormal(hit);
			//var fwd:Vector3 = trans.forward;
			//var up:Vector3 = trans.up;
			//var proj:Vector3 = fwd - (Vector3.Dot(fwd, hit.normal)) * hit.normal;
			//var angle = 0.0; var axis = Vector3.zero; transform.rotation.ToAngleAxis(angle, axis); 
			
			var fwd2:Vector3 = trans.TransformDirection(Vector3.forward);
			var up2:Vector3 = trans.TransformDirection(Vector3.up);
			Debug.DrawRay(hit.point, fwd2, Color.blue);
			Debug.DrawRay(hit.point, up2, Color.green);
			Debug.DrawRay(hit.point, norm, Color.cyan);
			if (Mathf.Abs(Vector3.Dot(fwd2, norm)) > 0.5) {
				var tmp:Vector3 = fwd2;
				fwd2 = up2;
				up2 = tmp;
			}
			var rot:Quaternion = 
				//Quaternion.AngleAxis(angle, norm);  // Bad.
				//Quaternion.LookRotation(fwd, norm);  // Too stable. Preserves forward forward and up second.
				//Quaternion.LookRotation(Vector3.forward, norm); // Too stable.
				//Quaternion.LookRotation(proj, norm); // Mostly like trans.up = norm, below, but not not really.
				//Quaternion.FromToRotation(up, norm);  // Very jittery
				//Quaternion.FromToRotation(Vector3.up, norm); // Works, but sometimes has rotation around local z.
				Quaternion.LookRotation(fwd2, up2);
			trans.rotation = rot;
			//trans.up = norm;  // same as using FromToRotation(Vector3.up, norm), above.
			
			//selected.transform.parent.rotation = Quaternion.FromToRotation(selected.transform.parent.up, norm);
			//if (Mathf.abs(norm.dot(Vector3.right)) > 0.99) {
			//	selected.transform.forward = Vector3.forward;
			//} else {
			//	selected.transform.parent.right = Vector3.right;
			//}
		} else if (hit.collider != selected) {
			Debug.Log("new");
			Select(hit.collider);
		}
	} else {
		if (selected) UnSelect();
	}
	
}