// BUGS:
// Drag orientation not s table.
// Overlapping picture won't wrap. (Bug in PictureDrawing.)

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
function StatusMessageStart(msg) {
	if (Application.isWebPlayer) {
		Application.ExternalCall('statusMessageStart', msg);
	} else {
		Debug.LogWarning(msg);
	}
}
function StatusMessageUpdate(msg, update, progress) {
	if (Application.isWebPlayer) {
		Application.ExternalCall('statusMessageUpdate', msg, update, progress);
	} else {
		Debug.LogWarning(msg + ': ' + (update || 'completed') + ' ' + progress);
	}
}

private var cam:Camera;  // The camera in which screen coordinates are defined.

///////////////////////////////////////////////////////////////////
// File drag and drop.
// Message from the browser to here can only take one argument.
// We break file drop into two messages:
//    setImportTarget('ddxdd')   - once per drop
//    setImportFilename('name') - once per file
//    importImage('URL') - once per file in the drop (file URL in editor, data url in browser)
public var picturePrefab:Transform;
public var dropTarget:RaycastHit;
public var dropObject:Transform;
// Browser input button file input sets an object, not a coordinate.
function setImportObject(path:String) { 
	if (path == '/') dropObject = GameObject.FindWithTag('SceneRoot').transform;
	else dropObject = GameObject.Find(path).transform;
	NotifyUser('drop to ' + dropObject + ' @' + dropObject.position);
}
function setImportTarget(coordinates:String) {
	var stupidNETcharArray:char[] = ['x'[0]];
	var pair = coordinates.Split(stupidNETcharArray);
	var x:int = int.Parse(pair[0]);
	var y:int = int.Parse(pair[1]);
    var pointerRay:Ray = cam.ScreenPointToRay(Vector3(x, y, 0));
	if (Physics.Raycast(pointerRay, dropTarget)) {
		NotifyUser('got object ' + dropTarget.transform.gameObject + ' at ' + x + 'x' + y);
	} else Debug.LogError('no drop target found at ' + x + 'x' + y);
	dropObject = null;
}
public var currentDropFilename:String;
function setImportFilename(name:String) {
	// In the browser, the importImage url will be a data url, which does not have a filename.
	// But we need a filename in order to be able to give the user meaningful
	// error/progress messages.
	currentDropFilename = name;
}
function importImage(url:String) {
	var pt = (dropObject == null) ? dropTarget.point : dropObject.position;
	var max = url.Length;
	if (max > 256) max = 128;
	NotifyUser('importing: ' + url.Substring(0, max) + ' to ' + pt); //because .NET has to be different. No slice.

	var www:WWW = new WWW(url);
    yield www;
    NotifyUser('received import data');
    // FIXME: if dropObject, replace the image?
    var v = pt - cam.transform.position;
    if (v.magnitude < 1) v = v.normalized;
    var pos = cam.transform.position + (v / 2);
    var rot = Quaternion.LookRotation(-v);
    Debug.Log('camera:' + cam.transform.position + ' v:' + v + ' pos:' + pos);
    var pict = Instantiate(picturePrefab, pos, rot);
    pict.transform.Rotate(90, 0, 0);
    pict.transform.parent = GameObject.FindWithTag('SceneRoot').transform;
    var mat = Material(pict.renderer.sharedMaterial);
    mat.mainTexture = www.texture;
    pict.renderer.material = mat;
    
    var form = new WWWForm();
   	var bytes = www.texture.EncodeToPNG(); // Our upload is always image/png, regardless of drop.
   	var id = Utils.sha1(bytes);
    form.AddBinaryData('fileUpload', bytes, currentDropFilename, 'image/png');
   // Media upload is generally pretty slow, and we don't want the user
    // to exit the browser or close their laptop during that time, so we
    // we let the user know what's happening.
    // IWBNI we showed upload progress, but WWW.uploadProgress is broken in the Web player.
    var msg = 'saving ' + currentDropFilename;
    StatusMessageStart(msg);
	www = WWW('http://' + Save.host + '/resources/' + id, form);
	yield www;
	var result = www.error ? 'failed upload of ' : 'saved ';
	result += currentDropFilename + ': ' + (www.error || www.text);
	StatusMessageUpdate(msg, result, 1.0);
}

/*function Start() {  // For debugging
	if (Application.isWebPlayer) return;
	var basename = 'avatar.jpg';
	var furl = 'file:///Users/howardstearns/Pictures/' + basename;
	yield WaitForSeconds(4);
	Debug.Log('import ' + basename);
	//setImportTarget('374x300');
	setImportObject('/');
	setImportFilename(basename);
	importImage(furl); 
}*/

///////////////////////////////////////////////////////////////////
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

/****************************************************************************************************/
// To highlight an object (e.g., for mouseover), we install in object a copy of it's materials,
// and then oscilate the color.
private var oldMaterials:Material[];    		// A copy of the material original material set.
private var oscillateStartTime = 0.0;  			// 0 stops any oscillating coroutine.
public var period = (2 * 0.8)/(2 * Mathf.PI); 	// Two beats of our standard 75bpm tempo.
// Highlight obj. Behavior is undefined if any object (same obj or not) is already highted.
function Highlight(obj:GameObject) {
	if (!obj.renderer) return;  // Attempt to highlight the avatar or some such
	oscillateStartTime = Time.time;
	// We must make a copy of the materials before we start throbbing them, because they might share with other materials.
	oldMaterials = obj.renderer.sharedMaterials;
	var mats = obj.renderer.materials;
	obj.renderer.materials = mats;
	// Allows block faces to continue sharing material with the block (so that they oscillate, too).
	obj.SendMessage("NewMaterials", null, SendMessageOptions.DontRequireReceiver);
	//mat.SetColor('_Emission', Color.white);
	while (oscillateStartTime != 0.0) {
		var fraction = (1 + Mathf.Sin((Time.time - oscillateStartTime)/period + Mathf.PI/2.0)) /2.0;
		//var fraction = Mathf.PingPong(Time.time - oscillateStart, 1.0);
		fraction = fraction / 3.0 + 0.666667;
		for (var i = 0; i < mats.Length && i < oldMaterials.Length; i++) {
			mats[i].color = fraction * oldMaterials[i].color;
			//mat.SetColor('_Emission', (1 - fraction) * oscillateStartColor);
		}
		yield;
	}
}
// Remove highlighting from obj. Behavior is undefined if obj was not the most recently highlighted.
function UnHighlight() { if (selection != null) UnHighlight(selection.gameObject); }
function UnHighlight(obj:GameObject) {
	if (obj.renderer == null) return;
	if (!oldMaterials || !oldMaterials.length) return;
	obj.renderer.sharedMaterials = oldMaterials;
	oscillateStartTime = 0;
	obj.SendMessage("NewMaterials", null, SendMessageOptions.DontRequireReceiver);
	oldMaterials = null;
}

/****************************************************************************************************/
// The gizmo is the interactive in-scene object used to adjust position/orientation/scale of objects.
public var gizmoPrefab:Transform;  // The prefab.
public var gizmo:Transform;  // The currently active gizmo. Should we really instantiate/destroy each time?
public var gizmoOldParent:Transform; // When gizmo is on, it's parent object is held by avatar.
public var overlayControls:OverlayControls; // A script that controls whether mouse motion is tracked.
function StopGizmo() {
	if (!gizmo) return;
	gizmo.parent.parent = gizmoOldParent;
	gizmoOldParent = null;
	gizmo.parent = null;
	Destroy(gizmo.gameObject);
	gizmo = null;
}
function StartGizmo(trans:Transform) {
	StopGizmo();
	gizmo = Instantiate(gizmoPrefab, trans.position, trans.rotation).transform;
	gizmo.parent = trans;
	// trans.parent.localScale will mess us up:
	gizmoOldParent = trans.parent;
	trans.parent = transform; // e.g. avatar
	overlayControls.lockMouseMotionOff();
}

/***************************************************************************/
// Dragging state
// When an object is being dragged, we keep track of it here. Otherwise null.
// During dragging, we add an empty, unit-scaled pivot transform to the avatar 
// (so that it is still in the scene graph, but with out any scaled ancestors), 
// and then put the dragged transform under the pivot.
private var dragged:Transform = null;
// During dragging, we also put the dragged onto the Ignore Raycast layer so that
// we don't try drag the object onto itself.
private var savedLayer:int;
private var cursorOffsetToSurface:Vector3 = Vector3.zero;
private var laser:GameObject;

function SetAssemblyLayer(obj:GameObject, layer:int) {
	obj.layer = layer;
	for (var child:Transform in obj.transform) {
		SetAssemblyLayer(child.gameObject, layer);
	}
}

// Shuts down any dragging going on. Safely does nothing if no drag in progress.
function StopDragging() {
	if (!dragged) return;
	// Reset drag state.
	cursorOffsetToSurface = Vector3.zero;
	// Restore dragged object
	SetAssemblyLayer(dragged.gameObject, savedLayer);
	var pivot = dragged.parent;
	dragged.parent = pivot.parent;
	if (pivot.parent) Debug.LogError('*** onStop Non-null pivot parent ' + pivot.parent);
	if (pivot.localScale != Vector3(1, 1, 1)) Debug.LogError('*** onstop Non-unity pivot scale ' + pivot.localScale);
	
	//Debug.Log('removal: pivot parent:' + pivot.parent + ' dragged scale:' + dragged.localScale + ' was:' + FIXMEoldScale);
	// Destroy merely schedules destruction. We don't want pivot in the hierarchy (e.g., during saving).
	pivot.parent = null; 
	Destroy(pivot.gameObject);
	// Restore cursor
	Screen.showCursor = true;
	Destroy(laser);
	dragged = null;
}

// 	
function StopDragging(hit:RaycastHit) {
	var trans = dragged;
	StopDragging();
	// Make the dragged object a child of the hit.
	// After things stabilize, this could be combined with the reparenting above.
	var obj:GameObject = hit.collider.gameObject;
	if (!!trans) trans.parent = obj.transform;
	//Debug.Log('reparenting:' + obj + ' dragged scale:' + trans.localScale);
	if (Vector3.Distance(firstDragPosition, lastDragPosition) > 0.2) 
		obj.SendMessage("saveScene", null, SendMessageOptions.DontRequireReceiver);
	else if (!!trans) Camera.main.transform.parent.GetComponent(Goto).Goto(trans, true);
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
	dragged = obj.transform;
	var comp = obj.GetComponent(Obj);
	var mountingDirection = comp ? dragged.TransformDirection(comp.localMounting) : -dragged.up;
//	var debugStart = dragged.position;
	if (selection != obj.collider) Debug.Error('FIXME selection does not match hit.collider');
	
	// Two Tests:
		
	// We will project the hit.point along the mountingDirection until we hit
	// a surface to slide along. No surface means we give up. 
	var surfaceHit:RaycastHit; 
	SetAssemblyLayer(obj, 2); //Don't intersect with the object itself.
	var selectedHit = hit.point;  // Start with where the user clicked on the obj.
	// Push the selectedHit a bit towards the obj center, so that we don't miss the edge on reversal.
	selectedHit += (obj.renderer.bounds.center - selectedHit).normalized * 0.1;
	// Any object on any layer will do. (No layer mask.)
	if (!Physics.Raycast(selectedHit, mountingDirection, surfaceHit)) { 
		NotifyUser("Nothing under object to slide along.");
		dragged = null;
		SetAssemblyLayer(obj, savedLayer);
		return; 
	}

    // Now the reverse: the surfaceHit.point back to the object.
    var reverseHit:RaycastHit; 
    // But use a point "below" the hit.point (into surface, by depth of object) so we can catch embedded objects.
    var embeddedPoint = surfaceHit.point + (mountingDirection * obj.renderer.bounds.size.magnitude); //obj.transform.localScale.magnitude);  
    var reverseRay = Ray(embeddedPoint, -mountingDirection);
    var offset = Vector3.zero;
    var isMeshCollider = obj.GetComponent(MeshCollider) != null;
    var oldConvex = isMeshCollider && obj.collider.convex;
    if (isMeshCollider) obj.collider.convex = true;  // so raycast can hit back of plane
 	if (obj.collider.Raycast(reverseRay, reverseHit, Mathf.Infinity)) { 
 		offset = surfaceHit.point - reverseHit.point;
       	Debug.Log('hit:' + surfaceHit.point + ' reverse:' + reverseHit.point + ' offset:' + offset);
		dragged.position += offset;
	} else { 
		Debug.LogError('** No reverse hit! ** hit:' + surfaceHit.point + ' mounting:' + mountingDirection + ' embedded:' + embeddedPoint);
	}
	if (isMeshCollider) obj.collider.convex = oldConvex;
	// Set drag state
	firstDragPosition = surfaceHit.point;
	lastDragPosition = firstDragPosition;
	rt1 = dragged.right; 
	fwd1 = dragged.forward;
	var contact:Vector3 = cam.WorldToScreenPoint(lastDragPosition);
	contact.z = 0;
	cursorOffsetToSurface = contact - Input.mousePosition;
	// Replace cursor with laser.
	Screen.showCursor = false;
	laser = Instantiate(laserPrefab.gameObject);
	between(laser, shoulder.position, surfaceHit.point, 0.05);
	laser.transform.parent = transform; // avatar (or whatever script is attached to)
	// Setup up pivot.
	var pivot = Instantiate(pivotPrefab, lastDragPosition, dragged.rotation);  
	if (pivot.parent) Debug.LogError('*** FIXME Select:StartDragging Non-null pivot parent ' + pivot.parent);
	if (pivot.localScale != Vector3(1, 1, 1)) Debug.LogError('*** FIXME Selec t:StartDragging Non-unity pivot scale ' + pivot.localScale);
	pivot.parent = transform.parent;   // FIXME should it be null in case avatar riding a vehicle?  (... i.e avatar parent, not the dragged parent (as that plays havoc with scale).
	dragged.parent = pivot;
}

function DoDragging(hit:RaycastHit) {
	var delta = hit.point - lastDragPosition;
	lastDragPosition = hit.point;
	between(laser, shoulder.position, hit.point, 0.1);
	var pivot:Transform = dragged.parent;
	//if (delta.sqrMagnitude > 0.01) Debug.Log('delta:' + delta);
	pivot.Translate(delta, Space.World);
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
	pivot.rotation = Quaternion.LookRotation(fwd, norm);
	if (Application.isWebPlayer) {
		// While local values (relative to parent) might make more sense to 
		// experts, they will just be confusing to most users, so just use global.
		var pos = pivot.position;
		var rot = pivot.eulerAngles;
		Application.ExternalCall('updatePosition', pos.x, pos.y, pos.z);
		Application.ExternalCall('updateRotation', rot.x, rot.y, rot.z);
	}
}

/************************************************************************************/
public var selection:Collider;
function Selection(col:Collider) {
	if (col == selection) return;
	UnSelection();
	selection = col;
	Highlight(selection.gameObject);
}
function UnSelection():boolean { // May or may not have been dragging. Answer true if we were.
	var didSomething:boolean = !!dragged && !!selection;
	StopDragging();  // before we unselect.
	if (selection != null) {
		UnHighlight(selection.gameObject);
		selection = null;
	} 
	return didSomething;
}
function Update () {
	if (Input.GetAxis("Horizontal") || Input.GetAxis("Vertical")) {
		StopGizmo();
		UnSelection();
		Obj.SceneSelect();
		return;
	}
    var hit:RaycastHit;
    var pointerRay:Ray = cam.ScreenPointToRay(Input.mousePosition + cursorOffsetToSurface);
    // We don't use OnMouseDown and friends, because that doesn't tell us the precise hit.point.
    // As long as we're going to need to Raycast, we might as well do that to start.
    // We cast only against the Default layer (0). E.g., we don't want this to catch the gizmo on the HUD layer (8).
	if (Physics.Raycast(pointerRay, hit, Mathf.Infinity, (1<<0))) {
		if (Input.GetMouseButtonDown(1) || 
			(Input.GetMouseButtonDown(0) && (Input.GetAxis('Fire2') || Input.GetAxis('Fire3')))) {
			hit.collider.gameObject.GetComponent(Obj).ExternalPropertyEdit('properties', true);
			if (!Application.isWebPlayer) StartGizmo(hit.transform);
			// else changing tab will call back to us to StartGizmo.
		} else if (Input.GetMouseButtonDown(0)) { 
			StartDragging(hit);
		} else if (Input.GetMouseButtonUp(0)) {
			StopDragging(hit);
		} else if (dragged) {
			if (!selection) { StopDragging(); return; }
			DoDragging(hit);		
		} else {
			Selection(hit.collider);
		}
	} else {
		if (UnSelection()) NotifyUser("You have reached the edge of all surfaces.");
	}	
}

/************************************************************************************/
function Awake() {
	cam = Camera.main;
	if (overlayControls == null) overlayControls = GameObject.Find('/PlayerOverlay').GetComponent(OverlayControls);
}


// FIXME: Move this to update so as to be independent of load.
// FIXME: Set the distance to travel in StartDragging, but don't actually
// start moving until we're actually dragging, and cancel if no drag.
/*function animateSelectionToSurface(displacement:Vector3) {
	var span = 0.500;   
	var interval = 0.025;
	var trans = selection.transform;
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
