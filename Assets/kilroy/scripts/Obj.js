// (Attach to each such object. id and hash are set by Save/Restore scripts.)
public var id = ''; // The Kilroy persistence id.
public var localMounting = Vector3(0, -1, 0);
public var localFacing = Vector3(0, 0, -1);
public var nametag = '';
public var description = '';
public var author = '';
// Usually the same as id, but cand be different for groups (such as scenes).
// Used to determine if there's been a change.
public var hash = ''; 
public var versions:Object; // Only used for groups
public var timestamp:String;

public static var InstanceCounter = 0; // Sometimes used for debugging.
public var instanceCounter = 0;

// hashtable.Keys doesn't specify order. Here we have latest last.
function timestamps():Array {
	var keys = new Array(versions.Keys); 
	return keys.Sort();
}

function isGroup() {
	if (id == '') return false;
	return id.length != hash.length; 
}
function renamePlace() { // every place must have a unique name. Use after import or copy.
	if (!isGroup()) { return; }
	id = 'G'; // Will get assigned a guid during save.
	for (var child:Transform in transform) {
		var childObj = child.GetComponent.<Obj>();
		if (childObj) { childObj.renamePlace(); }
	}
}
private function makeNotPlace() {  // Kills the "place"-ness of this and descendants if necessary.
	if (!isGroup()) { return; }
	id = ''; // Will get assigned a hash during save
	for (var child:Transform in transform) {
		var childObj = child.GetComponent.<Obj>();
		if (childObj) { childObj.makeNotPlace(); }
	}
}	
function enforcePlaceRules() { //places can only have places as parents
	if (!transform.parent || transform.parent.GetComponent.<Obj>().isGroup()) { return; }
	makeNotPlace();
}


public var kind = '';
function Start() {
	if (kind == '') {
		var m = gameObject.GetComponent.<MeshFilter>();
		if (!!m)  {
			kind = m.sharedMesh.name;
		} else {
			l = gameObject.GetComponent.<Light>();
			if (!!l) kind = l.type.ToString();
		}
		// When a prefab gets frobbed, the name changes from 'Foo' to 'Foo instance'.
		// We don't want that. (IWBNI we tracked that down.)
		var index = kind.IndexOf(' Instance');
		if (index >= 0) kind = kind.Remove(index);
	}
	if (kind == 'Plane') localFacing = Vector3(0, 1, 0);
	instanceCounter = InstanceCounter++;
}

/* NOT USED
// Answer a qualifer integer that, if non-zero and appended to idtag, will produce a name that is unique among the children of p.
// ignored Transform will be ignored if it is among the children of p.
// The current implementation simplifies debugging by answering zero when possible, but if that's too slow for bushy scene graphs,
// we could change it to just increment a global counter and use the alternative code for FindById, below
public static function ComputeQualifier(idtag:String, p:Transform, ignored:Transform) { // answer the number of children in p that have idtag
	var count = 0;
	for (var child:Transform in p) {
		if (child == ignored) { continue; }
		if (child.gameObject.GetComponent.<Obj>().id == idtag) { count++; }
		else if (count) { break; } // optimization based on Unity's current practice of keeping children in alphabatical order
	}
	return count;
}*/
// Make sure that child has a unique name among its siblings. We rely on Unity keeping siblings in alphabetical order, and our
// own scheme of using id for name unless the previous sibling has id, in which case we add a suffix that preserves order.
public static function NameUniquely(child:Transform, previous:Obj):Obj {
	var obj = child.gameObject.GetComponent.<Obj>();
	if (!obj) return previous;  // There are meshes and adjusters in the scene graph, which do not effect our naming.
	var id:String = obj.id;
	if (!previous || (id != previous.id)) { child.name = id; return obj; }
	// Otherwise calculate a new name for child that will not conflict with the previous instance name (not just it's id).
	// concatenate the next digit. Cheaper than slicing and parsing.
	child.name = previous.name + ((previous.name.length - id.length) % 10);
	Debug.Log('child ' + id + ' => ' + child.name + ' prev:' + (previous ? previous.name : 'none'));
	return obj;
}
// Answers one (of the possibly many) GameObjects with the given id, else null.
// id is an objectIdtag and may be falsey.
public static function FindById(idtag:String):GameObject {
	// This works in current implementation of ComputeQualifier...
	return !idtag ? null : GameObject.Find(idtag);
	/* ... other wise use this:
	return !idtag ? null : findById(GameObject.FindWithTag('SceneRoot'), idtag);
}
private static function findById(go:GameObject, idtag:String):GameObject {
	var obj = go.GetComponent.<Obj>();
	if (!obj) { return null; }
	if (obj.id == idtag) return go;
	for (var child:Transform in go.transform) {
		var got = findById(child.gameObject, idtag);
		if (got != null) return got;
	}
	return null;*/
}
// Answers the unique object in the scene identified by a string produced by GameObjectPath.
public static function FindByPath(path:String):GameObject {
	// The browser's setProp has three pieces of info -- path, property name, and value -- which is exactly
	// what SendUnity can handle IFF path is a name or scene-graph of names. So really, FindByPath must work the same 
	// as the plugin's first argument to SendMessage.
	return GameObject.Find(path);
}
public static function FindByPathOrId(pathOrId:String):GameObject {
	// In the current implementation, this works for both. Otherwise, check for '/' and pick the right one.
	return GameObject.Find(pathOrId);
}
// Answers the scene graph path to obj, suitable for use in FindByPath, and by the browser's SendUnity.
function GameObjectPath():String {
	// If name was globally unique (e.g., if ComputeQualifier just used a per-scene counter), then we
	// could just answer name (because GameObject.Find can work with partial paths). But if name is onl
	// unique among siblings, we must answer a scene-graph path.
	var path = "/" + name;
    var obj = transform;
    while (obj.parent != null) {
        obj = obj.parent;
        path = "/" + obj.name + path;
    }
    return path;
}
function FindNametag(t:String):Transform { // Find first t among our nametags. Currently depth-first.
	if (nametag == t) return transform;
	for (var child:Transform in transform) {
		var childObj = child.GetComponent.<Obj>();
		var got = childObj ? childObj.FindNametag(t) : null;
		if (got != null) return got;
	}
	return null;
}

public var mesh:GameObject;
public var dims:Vector3; // public for debuggin only. Use size().
public function size() { 
	if (!mesh) {
		var v = gameObject.transform.localScale;
		//var v = gameObject.transform.lossyScale;
		//Debug.Log(kind + '.size() => ' + v + '  ' + gameObject);
		return v;
	}
	return dims;
}
public function size(v:Vector3) { 
	if (!mesh) {  // i.e., temporary cube
		gameObject.transform.localScale = v;
		dims = v; 
		return v;
	}
	var s = v;
	// Unity planes are 10x10, and don't render at all unless there is a non-zero Y.
	if (kind == 'Plane') { s *= 0.1; s.y = 0.001; }
	mesh.transform.localScale = s;
	dims = v;
	return v;
}
public function isTargetable():boolean {
	return !!objectCollider();
}
public function bounds():Bounds { // Answer world space Bounds. (Do we want just our collider, or all children (i.e., renderer.bounds)?)
	var go = !!mesh ? mesh : gameObject;
	if (!go.collider) { return Bounds(go.transform.position, Vector3.zero); }
	return go.collider.bounds;
}
public function objectCollider():Collider { // Answer our Collider
	var go = !!mesh ? mesh : gameObject;
	return go.collider;
}
// Answer our shared Materials array (even if just an array of one). Side-effecting any resulting element (but not the whole Array) changes for all.
public function sharedMaterials():Material[] { 
	var go = !!mesh ? mesh : gameObject;
	var r = go.renderer;
	var m:Material[];
	var block = gameObject.GetComponent.<BlockDrawing>();
	if (!r && !block) m = new Material[0];
	else if (block) m = block.sharedMaterials();
	else m = r.sharedMaterials;
	return m;
}
// Materials may have large textures that take a while to download. We don't want to wait for that before we can ask the obj for the material data needed for saving.
// We can save the material data here during restoration, so we don't have to wait for download before saving.
public var materialData:Object = null; // We use null as way to clear the value, and the plugin sometimes forces it at compile-time to truthy if there's an Array declaration.
// Assign new sharedMaterials and answer the new value.
public function sharedMaterials(mats:Material[]):Material[] {
	var go = !!mesh ? mesh : gameObject;
	var r = go.renderer;
	var block = gameObject.GetComponent.<BlockDrawing>();
	materialData = null; // clear cache so that it gets regenerated on save.
	if (!r && !block && !mats.Length) return mats;
	else if (block) block.sharedMaterials(mats);
	else r.sharedMaterials = mats;	
	return mats;
}

// Answer the Kilroy GameObject of the given c, else c's non-avatar parent GameObject, else null.
public static function ColliderGameObject(c:Collider):GameObject { 
	if (c == null) { return null; }
	if (c.gameObject.GetComponent.<Obj>()) return c.gameObject;
	//Debug.Log('colliderGameObject(' + c.gameObject + ') parent:' + c.transform.parent.gameObject);
	if (!c.transform.parent) return null;  // e.g., avatar
	return c.transform.parent.gameObject;
}

/***************************************************************************************/
public function deleteObject() {
	enabled = false;  // first unhook me without destroying, so that I can save. Toplevel object have null parents, so null parent can't be used to tell.
	Save.RemoveTabItem(transform);
//	Application.ExternalCall('notifyUser', 'deleted:' + nametag);
	saveScene('delete'); // will do the destroying on the callback.
	if (!saveEnabled()) Destroy(gameObject); // we won't get a callback, so scheduled Destroy now.
}

public static var SelectedId = null; // global state for this user.

// SceneSelect and ExternalPropertyEdit may both send browser 'select' with an optional idvtag to add to history.
// However, the functions here can also take a true/false/null addToHistory argument:
// false: from driving->SceneSelect or browser->goBackTo|RestoreBackTo: send select(...false)
// true: from click|metaclick|tab -> ExternalPropertyEdit: send select(...true)
// null: from SceneRestore=>GoToObj send nothing at all if SelectedId is wrong (see RestoreScene comments), otherwise send select(...true)
public static var NoShortCircuit = 'NonNullUnique'; // not an objectId or empty
public static function SceneSelect(addToHistory) { // Tell browser to select whole scene.
	if ((addToHistory == false /*explicitly*/) && !SelectedId) return; //unecessary calls don't hurt anything, but they can be confusing for logging.
	var root = GameObject.FindWithTag('SceneRoot');
	var rootComponent = root.GetComponent.<Obj>();
	var tag = rootComponent.nametag;
	Application.ExternalCall('props', rootComponent.GameObjectPath(), tag, rootComponent.author, rootComponent.description, Save.GetTabItems()); // regardless of addToHistory, etc.
	if (addToHistory == null) {
		if (!SelectedId) return;
		else addToHistory = (SelectedId != NoShortCircuit);
	}
	SelectedId = null;
	Application.ExternalCall('select', rootComponent.id, tag, addToHistory ? rootComponent.hash : '', rootComponent.author, rootComponent.description);
}
function structureInfo(trans:Transform):Hashtable { // Not used yet. To appear below.
	var o = trans.gameObject.GetComponent.<Obj>(); 
	var d = new Hashtable();
	Debug.Log('info for ' + trans + ' ' + o);
	Debug.Log('details ' + o.id + ' ' + o.nametag);
	d[o.id] = o.nametag;
	return d;
}
// Tell external property editor about this object's editable properties, and select the object.
function ExternalPropertyEdit(tabName:String, addToHistory) {
	// Update properties regardless of whether we 'select'. Must be before 'select' so that path is set if select needs to setProp of anything.
	Interactor.Avatar().GetComponent.<Select>().StopGizmo(); 
	var path = GameObjectPath();
	var pos = gameObject.transform.localPosition;
	var rot = gameObject.transform.localEulerAngles; //Not what we persist, but easier for users.
	var size = size();
	Application.ExternalCall('updatePosition', pos.x, pos.y, pos.z);
	Application.ExternalCall('updateRotation', rot.x, rot.y, rot.z);
	Application.ExternalCall('updateSize', size.x, size.y, size.z);
	Application.ExternalCall('props', path, nametag, author, description);
	/*var structure = {'children': new Array()};
	Debug.Log('parent:' + transform.parent);
	if (transform.parent != null) { structure['parent'] = structureInfo(transform.parent);}
	for (var child:Transform in transform) { 
		structure['children'].Push(structureInfo(child));
	}
	Application.ExternalCall('structure', JSON.Stringify(structure));*/
	if (addToHistory == null) {
		Application.ExternalCall('notifyUser', 'ExternalPropertyEdit(' + tabName + ', null), id=' + id + ', Obj.SelectedId=', Obj.SelectedId);
		if (Obj.SelectedId == id) return;
		else addToHistory = (SelectedId != NoShortCircuit);
	}
	SelectedId = id;
	Application.ExternalCall('tabSelect', tabName);
	Application.ExternalCall('select', id, nametag, addToHistory ? hash : '', author, description);
}

public var saver:Save; // Save script, if available.
function saveEnabled():boolean { return !!saver && saver.enabled; }
function Awake() { // Initialize saver, if available.
	if (saver == null) {
		var root = GameObject.FindWithTag('SceneRoot'); // Tag, because it could be named anything.
		if (root != null) saver = root.GetComponent.<Save>();
	}
}
function saveScene(action:String) { // Save whatever needs to be saved from the whole scene (or silently skip if not set up to save).
	if (!saveEnabled()) { Debug.Log('skipping save of ' + name); return; } 
	enforcePlaceRules(); // Whether dragging, copying, or importing, the only way to re-parent a place is through here.
	//	debugging: Application.ExternalCall('notifyUser', 'now '+ transform.position.ToString() + ' ' + transform.eulerAngles.ToString() + ' ' + transform.lossyScale.ToString());	
	timestamp = saver.PersistScene(this, action); // for value and for the side-effect on id.
}
function savedScene(action:String, changes:Array):IEnumerator { // Callback from saveScene.
	yield gameObject.GetComponent.<PictureCapture>().Thumbnail(changes);
	Application.ExternalCall('saved', id, nametag, timestamp, action, hash, GameObjectPath());
	switch (action) {
	case 'import': ExternalPropertyEdit('metadata', false); break;
	case 'delete': 
		SelectedId = id; /* so select fires */ 
		SceneSelect(false); // In case now-deleted object was selected.
		break;
	case 'tab order': break;
	case 'sway':
	case 'heave':
	case 'surge':
	case 'pitch':
	case 'yaw':
	case 'roll':
	case 'width':
	case 'height':
	case 'length':
	case 'nametag':
	case 'description':
		Application.ExternalCall('props', GameObjectPath(), nametag, author, description, !transform.parent ? Save.GetTabItems() : null);
		break;
	}
	if (!enabled) { Destroy(gameObject); } // if deleted, can only safely be destroyed now.
}
	

/*****************************************************************************************/
// The following are all messages sent from outside, to change a property of this object.
// e.g., from browser-based property editors using GetUnity().SentMessage(path, functionName, singleArgument).
// SendMessage in the browser can only send one (String) argument (other than the path), so we need separate functions 
// for each of these.
function setPositionX(v:String) {var vec = transform.localPosition; transform.localPosition = Vector3(parseFloat(v), vec.y, vec.z); saveScene('sway');}
function setPositionY(v:String) {var vec = transform.localPosition; transform.localPosition = Vector3(vec.x, parseFloat(v), vec.z); saveScene('heave');}
function setPositionZ(v:String) {var vec = transform.localPosition; transform.localPosition = Vector3(vec.x, vec.y, parseFloat(v)); saveScene('surge');}

function setRotationX(v:String) {var vec = transform.localEulerAngles; transform.localEulerAngles = Vector3(parseFloat(v), vec.y, vec.z); saveScene('pitch');}
function setRotationY(v:String) {var vec = transform.localEulerAngles; transform.localEulerAngles = Vector3(vec.x, parseFloat(v), vec.z); saveScene('yaw');} 
function setRotationZ(v:String) {var vec = transform.localEulerAngles; transform.localEulerAngles = Vector3(vec.x, vec.y, parseFloat(v)); saveScene('roll');}

// While the gizmo is up, we just set localScale. StopGizmo() will recompute size from localScale.
function setSizeX(v:String) {var vec = transform.localScale; transform.localScale = Vector3(parseFloat(v)/size().x, vec.y, vec.z); Directional.ApplyChanges(transform).saveScene('width');}
function setSizeY(v:String) {var vec = transform.localScale; transform.localScale = Vector3(vec.x, parseFloat(v)/size().y, vec.z); Directional.ApplyChanges(transform).saveScene('height');}
function setSizeZ(v:String) {var vec = transform.localScale; transform.localScale = Vector3(vec.x, vec.y, parseFloat(v)/size().z); Directional.ApplyChanges(transform).saveScene('length');}

function settag0(v:String) { nametag = v; saveScene('nametag'); }
function setDesc(v:String) { description = v; saveScene('description'); }
/***************************************************************************************/
public var deleteMe = false; // To delete in editor
function Update() {
	if (!deleteMe) return;
	deleteMe = false;
	deleteObject();
}