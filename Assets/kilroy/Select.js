//TODO: Avoid flicker in compound objects. Maybe caused children of moving object being on selectable layer.

function Log(s:String) {
	//Debug.Log('Select: ' + s);
}

function NotifyUser(msg) {
	if (Application.isWebPlayer) {
		//Application.ExternalEval("console.log('" + msg + "');");
		Application.ExternalCall('notifyUser', msg);
	} else {	// FIXME. Should really be some cool animation showing the problem, rather than text.
		print(msg);
	}
}

public var testObj:Transform;
function setImportTarget(coordinates:String) {
	var stupidNETcharArray:char[] = ['x'[0]];
	var pair = coordinates.Split(stupidNETcharArray);
	var x:int = int.Parse(pair[0]);
	var y:int = int.Parse(pair[1]);
	var hit:RaycastHit;
    var pointerRay:Ray = cam.ScreenPointToRay(Vector3(x, y, 0));
	if (Physics.Raycast(pointerRay, hit)) {
		NotifyUser('got object ' + hit.transform.gameObject + ' at ' + x + 'x' + y);
		testObj = hit.transform;
	}
}

function importImage(url:String) {
	var max = url.Length;
	if (max > 256) max = 128;
	//NotifyUser('importing: ' + url.Substring(0, max) + ' to ' + testObj.gameObject); //because .NET has to be different. No slice.
	var www:WWW = new WWW(url);
    yield www;
    testObj.renderer.material.mainTexture = www.texture; 
}

//function Start() { importImage('file:///Users/howardstearns/Pictures/avatar.jpg'); }


private var cam:Camera;
public var selectMaterial:Material;
private var oscillateStartColor:Color;
function Awake() {
	cam = Camera.main;
	oscillateStartColor = selectMaterial.color;
	if (overlayControls == null) overlayControls = GameObject.Find('PlayerOverlay').GetComponent(OverlayControls);
}

private var oldMaterial:Material;
private var oldColor:Color;
private var oscillateStart = 0.0;
public var period = (2 * 0.8)/(2 * Mathf.PI); 
function Highlight(obj:GameObject) {
	if (!obj.renderer) return;  // Attempt to highlight the avatar or some such
	oldMaterial = obj.renderer.material;
	var mat = Material(selectMaterial);
	obj.renderer.material = mat;
	oscillateStart = Time.time;
	mat.SetColor('_Emission', Color.black);
	mat.color = Color.black;
	while (oscillateStart != 0.0) {
		var fraction = (1 + Mathf.Sin((Time.time - oscillateStart)/period)) /2.0;
		//var fraction = Mathf.PingPong(Time.time - oscillateStart, 1.0);
		mat.color = fraction * oscillateStartColor;
		mat.SetColor('_Emission', (1 - fraction) * oscillateStartColor);
		yield;
	}
	/*oldColor = obj.renderer.material.color;
	obj.renderer.material.color = Color.green;*/
}
function UnHighlight(obj:GameObject) {
	if (oldMaterial == null) return;
	if (obj.renderer == null) return;
	var mat = obj.renderer.material;
	obj.renderer.material = oldMaterial;
	Destroy(mat);
	oscillateStart = 0;
	//obj.renderer.material.color = oldColor;
}


public var gizmoPrefab:Transform;
public var gizmo:Transform;
public var overlayControls:OverlayControls;
function StopGizmo() {
	if (!gizmo) return;
	gizmo.parent = null;
	Destroy(gizmo.gameObject);
	gizmo = null;
}
function StartGizmo(trans:Transform) {
	StopGizmo();
	gizmo = Instantiate(gizmoPrefab, trans.position, trans.rotation).transform;
	gizmo.parent = trans;
	overlayControls.trackMouseMotion(false, true);
}

public var selected:Collider;
function BrowserSelect(obj:Obj) {
	var id = (obj == null) ? '' : obj.id;
	// Now handled by Obj.OnMouseDown
	//if (Application.isWebPlayer) Application.ExternalCall('select', id);
	// FIXME restore: NotifyUser('New selection ' + id + ' @ ' + Input.mousePosition);
}

function Select(col:Collider) {
	UnSelect(false);
	selected = col;
	Highlight(selected.gameObject);
	BrowserSelect(selected.gameObject.GetComponent(Obj));
}
function UnSelect(force:boolean) { // May or may not have been dragging. Answer true if we were.
	var didSomething:boolean = isDragging && !!selected;
	StopDragging();  // before we unselect.
	if (selected) {
		UnHighlight(selected.gameObject);
		if (force) BrowserSelect(null);
		selected = null;
	}
	return didSomething;
}

// Utility functions
function between(verticalObject, p1, p2, width) {
	var offsetToCenter:Vector3 = (p1 - p2) / 2.0;
	verticalObject.transform.position = p1 - offsetToCenter;
	verticalObject.transform.up = p2 - p1;
	verticalObject.transform.localScale = Vector3(width, offsetToCenter.magnitude, width);
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

// Dragging state
private var isDragging:boolean = false;
private var savedLayer:int;
private var cursorOffsetToSurface:Vector3 = Vector3.zero;
private var laser:GameObject;

function SetAssemblyLayer(obj:GameObject, layer:int) {
	obj.layer = layer;
	for (var child:Transform in obj.transform) {
		SetAssemblyLayer(child.gameObject, layer);
	}
}

function StopDragging() {
	if (!isDragging) return;
	// Reset drag state.
	isDragging = false;
	cursorOffsetToSurface = Vector3.zero;
	// Restore dragged object
	SetAssemblyLayer(selected.gameObject, savedLayer);
	// FIXME remove selected.gameObject.layer = savedLayer;
	var pivot = selected.gameObject.transform.parent;
	selected.gameObject.transform.parent = pivot.parent;
	if (pivot.parent) Debug.LogError('*** onStop Non-null pivot parent ' + pivot.parent);
	if (pivot.localScale != Vector3(1, 1, 1)) Debug.LogError('*** onstop Non-unity pivot scale ' + pivot.localScale);
	
	//Debug.Log('removal: pivot parent:' + pivot.parent + ' selected scale:' + selected.transform.localScale + ' was:' + FIXMEoldScale);
	// Destroy merely schedules destruction. We don't want pivot in the hierarchy (e.g., during saving).
	pivot.parent = null; 
	Destroy(pivot.gameObject);
	// Restore cursor
	Screen.showCursor = true;
	Destroy(laser);
}
	
private var saver:Save;
function saveScene() {
	if (saver == null) {
		var root = GameObject.FindWithTag('SceneRoot');
		if (root != null) saver = root.GetComponent(Save);
	}
	if (saver != null) saver.Persist(saver.gameObject);
}
function StopDragging(hit:RaycastHit) {
	StopDragging();
	// Make selected a child of the hit.
	// After things stabilize, this could be combined with the reparenting above.
	var obj:GameObject = hit.collider.gameObject;
	selected.gameObject.transform.parent = obj.transform;
	Debug.Log('reparenting:' + obj + ' selected scale:' + selected.transform.localScale);
	if (Vector3.Distance(firstDragPosition, lastDragPosition) > 0.2)  saveScene();
	else Camera.main.transform.parent.GetComponent(Goto).Goto(selected.transform);
}

public var laserPrefab:Transform;
public var shoulder:Transform;
public var pivotPrefab:Transform;

private var lastDragPosition:Vector3;
private var firstDragPosition:Vector3; // For debouncing click vs drag;
private var rt1:Vector3;
private var fwd1:Vector3;

function StartDragging(hit:RaycastHit) {
	var obj:GameObject = hit.collider.gameObject;
	savedLayer = obj.layer;
	var mountingDirection:Vector3 = -obj.transform.up;
	
	// Two Tests:
		
	// We will project the hit.point along the mountingDirection until we hit
	// a surface to slide along. No surface means we give up.
	
	//obj.layer = 2; // Don't intersect with the object itself.
	SetAssemblyLayer(obj, 2); //Don't intersect with the object itself.
	var selectedHit = hit.point;
	// Push the selectedHit a bit towards the obj center, so that we don't miss the edge on reversal.
	selectedHit += (obj.renderer.bounds.center - selectedHit).normalized * 0.1;
	var hasSurface:boolean = Physics.Raycast(selectedHit, mountingDirection, hit);
	//obj.layer = savedLayer;
	if (!hasSurface) { 
		NotifyUser("Nothing under object to slide along.");
		SetAssemblyLayer(obj, savedLayer);
		return; 
	}

    // Now the reverse: the surface hit point back to the object.
	// Move that point down to the hit.point.
    var reverseHit:RaycastHit; 
    // But use a point "below" the hit.point (into surface, by depth of object) so we can catch embedded objects.
    var embeddedPoint = hit.point + (mountingDirection * obj.transform.localScale.magnitude);   
 	if (obj.collider.Raycast(Ray(embeddedPoint, -mountingDirection), reverseHit, Mathf.Infinity)) {
    	Debug.Log('hit:' + hit.point + ' reverse:' + reverseHit.point);
		selected.transform.position += (hit.point - reverseHit.point);
	} else { 
		Debug.LogError('** No reverse hit! **');
	}
	// Set drag state
	isDragging = true;
	var contact:Vector3 = cam.WorldToScreenPoint(hit.point);
	contact.z = 0;
	cursorOffsetToSurface = contact - Input.mousePosition;
	lastDragPosition = hit.point;
	firstDragPosition = hit.point;
	rt1 = selected.transform.right; //selected.transform.TransformDirection(Vector3.right);
	fwd1 = selected.transform.forward;
	// Replace cursor with laser.
	Screen.showCursor = false;
	laser = Instantiate(laserPrefab.gameObject);
	between(laser, shoulder.position, hit.point, 0.05);
	laser.transform.parent = transform; // avatar (or whatever script is attached to)
	// Setup up dragged obj and pivot
	//obj.layer = 2;
	var pivot = Instantiate(pivotPrefab, hit.point, selected.transform.rotation);
	if (pivot.parent) Debug.LogError('*** onstart Non-null pivot parent ' + pivot.parent);
	if (pivot.localScale != Vector3(1, 1, 1)) Debug.LogError('*** onstart Non-unity pivot scale ' + pivot.localScale);
	pivot.parent = transform.parent;   // Not the selected parent (as that plays havoc with scale).
	selected.transform.parent = pivot;
}

function DoDragging(hit:RaycastHit) {
	var delta = hit.point - lastDragPosition;
	lastDragPosition = hit.point;
	between(laser, shoulder.position, hit.point, 0.1);
	var trans:Transform = selected.transform.parent;
	trans.Translate(delta, Space.World);
	var norm:Vector3 = hitNormal(hit);
	var alignedX:boolean = Mathf.Abs(Vector3.Dot(rt1, norm)) > 0.9;
	var alignedZ:boolean = !alignedX && Mathf.Abs(Vector3.Dot(fwd1, norm)) > 0.9;
	var fwd:Vector3 = alignedX ? fwd1 : Vector3.Cross(rt1, norm);
			/*(alignedZ ? Vector3.Cross(fwd1, rt1) : fwd1); 
			var hit2:RaycastHit;
			if (!Physics.Raycast(pointerRay.origin + (fwd*0.1), pointerRay.direction, hit2)) {Log("second hit failed"); return;}
			fwd = hit2.point - hit.point;*/
		if (alignedX) Log('aligned X');
		if (alignedZ) Log('aligned Z');
		Debug.DrawRay(hit.point, rt1, Color.red);
		Debug.DrawRay(hit.point, norm, Color.green);
		Debug.DrawRay(hit.point, fwd.normalized, Color.blue);
	trans.rotation = Quaternion.LookRotation(fwd, norm);
	if (Application.isWebPlayer) {
		// While local values (relative to parent) might make more sense to 
		// experts, they will just be confusing to most users, so just use global.
		var pos = trans.position;
		var rot = trans.eulerAngles;
		Application.ExternalCall('updatePosition', pos.x, pos.y, pos.z);
		Application.ExternalCall('updateRotation', rot.x, rot.y, rot.z);
	}
}

function Update () {
	if (gizmo) {
		if (Input.GetAxis("Horizontal") || Input.GetAxis("Vertical")) StopGizmo();
		return;
	}
    var hit:RaycastHit;
    var pointerRay:Ray = cam.ScreenPointToRay(Input.mousePosition + cursorOffsetToSurface);
	if (Physics.Raycast(pointerRay, hit, Mathf.Infinity, (1<<0))) {
		if (Input.GetMouseButtonDown(1) || Input.GetMouseButtonDown(2)) {
			Debug.Log('Meta button');
			StartGizmo(hit.transform);
		} else if (Input.GetMouseButtonDown(0)) { 
			StartDragging(hit);
		} else if (Input.GetMouseButtonUp(0)) {
			StopDragging(hit);
		} else if (isDragging) {
			if (!selected) { StopDragging(); return; }
			DoDragging(hit);		
		} else if (hit.collider != selected) {
			Select(hit.collider);
		}
	} else {
		if (UnSelect(true)) NotifyUser("You have reached the edge of all surfaces.");
	}	
}

// FIXME: Move this to update so as to be independent of load.
// FIXME: Set the distance to travel in StartDragging, but don't actually
// start moving until we're actually dragging, and cancel if no drag.
/*function animateSelectionToSurface(displacement:Vector3) {
	var span = 0.500;   
	var interval = 0.025;
	var trans = selected.transform;
	if (displacement.sqrMagnitude < 0.02) {
		trans.localPosition += displacement;
		return;
	}
	var steps = span/interval;
	var increment = displacement / steps;
	while (steps-- > 0) {
		trans.localPosition += increment;
		yield WaitForSeconds(interval);
	}
}*/
