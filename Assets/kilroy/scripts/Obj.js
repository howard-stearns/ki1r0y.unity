// Standard behavior for each kilroy object in the scene graph. 
// (Attach to each such object. id and hash are set by Save/Restore scripts.)
public var id = ''; // The Kilroy persistence id.
public var localMounting = Vector3(0, -1, 0);
public var localFacing = Vector3(0, 0, -1);
public var nametag = '';
public var author = '';
// Usually the same as id, but cand be different for groups (such as scenes).
// Used to determine if there's been a change.
public var hash = ''; 
// only used for groups
public var versions:Object; 
public var timestamp:String;

// hashtable.Keys doesn't specify order. Here we have latest last.
function timestamps():Array {
	var keys = new Array(versions.Keys); 
	return keys.Sort();
}

function isGroup() {
	if (id == '') return false;
	return id.length != hash.length; 
}


public var kind = '';
function Start() {
	if (kind == '') {
		var m = gameObject.GetComponent(MeshFilter);
		if (!!m)  {
			kind = m.sharedMesh.name;
		} else {
			l = gameObject.GetComponent(Light);
			if (!!l) kind = l.type.ToString();
		}
		// When a prefab gets frobbed, the name changes from 'Foo' to 'Foo instance'.
		// We don't want that. (IWBNI we tracked that down.)
		var index = kind.IndexOf(' Instance');
		if (index >= 0) kind = kind.Remove(index);
	}
	if (kind == 'Plane') localFacing = Vector3(0, 1, 0);
}

// Answers the scene graph path to obj, suitable for use in Find().
// The browser will receive this and use it as the first arg to SendMessage.
function GameObjectPath():String {
	var path = id;
    /*var path = "/" + name;
    var obj = transform;
    while (obj.parent != null) {
        obj = obj.parent;
        path = "/" + obj.name + path;
    }*/
    return path;
}
function FindNametag(t:String):Transform {
	if (nametag == t) return transform;
	for (var child:Transform in transform) {
		var childObj = child.GetComponent(Obj);
		var got = childObj ? childObj.FindNametag(t) : null;
		if (got != null) return got;
	}
	return null;
}
public static var selectedId = null;
public static function SceneSelect() { SceneSelect(false); }
public static function SceneSelect(force:boolean) {
	if (force || (selectedId != null)) {
		selectedId = null;
		var root = GameObject.FindWithTag('SceneRoot');
		var rootComponent = root.GetComponent(Obj);
		Application.ExternalCall('select', null, rootComponent.nametag);
		if (Application.isWebPlayer) {
			Application.ExternalCall('props', '/');
		}
	}
}
function deleteObject() {
	transform.parent = null;  // first unhook me without destroying, so that I can save.
//	Application.ExternalCall('notifyUser', 'deleted:' + nametag);
	saveScene('delete');
	Destroy(gameObject);
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
	if (!mesh) {
		gameObject.transform.localScale = v;
		dims = gameObject.transform.lossyScale;
		return v;
	}
	mesh.transform.localScale = v;   // real version
//	gameObject.transform.localScale = v;  // transitional version
	dims = v;
	return v;
}
public function isTargetable():boolean {
	return !!objectCollider();
}
public function bounds():Bounds { // Answer world space Bounds. (Do we want just our collider, or all children (i.e., renderer.bounds)?)
	var go = !!mesh ? mesh : gameObject;
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
	var block = gameObject.GetComponent(BlockDrawing);
	if (!r && !block) m = new Material[0];
	else if (block) m = block.sharedMaterials();
	else m = r.sharedMaterials;
	return m;
}
// Assign new sharedMaterials and answer the new value.
public function sharedMaterials(mats:Material[]):Material[] {
	var go = !!mesh ? mesh : gameObject;
	var r = go.renderer;
	var block = gameObject.GetComponent(BlockDrawing);
	if (!r && !block && !mats.Length) return mats;
	else if (block) block.sharedMaterials(mats);
	else r.sharedMaterials = mats;	
	return mats;
}

// Answer the Kilroy GameObject of the given c, or null.
public static function ColliderGameObject(c:Collider):GameObject { 
	if (c.gameObject.GetComponent(Obj)) return c.gameObject;
	//Debug.Log('colliderGameObject(' + c.gameObject + ') parent:' + c.transform.parent.gameObject);
	if (!c.transform.parent) return null;  // e.g., avatar
	return c.transform.parent.gameObject;
}

public var deleteMe = false; // To delete in editor
function Update() {
	if (!deleteMe) return;
	deleteMe = false;
	deleteObject();
}

// Tell external property editor about this object's editable properties.
function ExternalPropertyEdit(tabName:String, addToHistory:boolean) {
	var path = GameObjectPath();
	selectedId = id;
	/*Application.ExternalCall('notifyUser', 
		'browser select ' + id + ' ' + path + ' ' + tabName 
		+ (addToHistory ? " addToHistory" : " suppressHistory"));*/
	//Debug.Log('localScale ' + gameObject.transform.localScale.ToString() + ' globalScale: ' + gameObject.transform.lossyScale.ToString());
	Application.ExternalCall('select', id, nametag, !addToHistory);
	if (Application.isWebPlayer) {
		Application.ExternalCall('tabSelect', tabName);
		var pos = gameObject.transform.localPosition;
		var rot = gameObject.transform.localEulerAngles; //Not what we persist, but easier for users.
		var scale = gameObject.transform.lossyScale;
		Application.ExternalCall('updatePosition', pos.x, pos.y, pos.z);
		Application.ExternalCall('updateRotation', rot.x, rot.y, rot.z);
		// FIXME: we must use id as name, because tags/name are not guaranteed to be unique!!
		Application.ExternalCall('props', path, scale.x, scale.y, scale.z);
	}
}

public var saver:Save; // Save script, if available.
function Awake() { // Initialize saver, if available.
	if (saver == null) {
		var root = GameObject.FindWithTag('SceneRoot'); // Tag, because it could be named anything.
		if (root != null) saver = root.GetComponent(Save);
	}
}
function saveScene(action) { // Save whatever needs to be saved from the whole scene (or silently skip if not set up to save).
	if (saver == null || !saver.enabled) return;
	//	debugging: Application.ExternalCall('notifyUser', 'now '+ transform.position.ToString() + ' ' + transform.eulerAngles.ToString() + ' ' + transform.lossyScale.ToString());	
	var tstamp = saver.PersistScene(); // for value and for the side-effect on id.
	Application.ExternalCall('saved', id, nametag, tstamp, action);
	gameObject.GetComponent(PictureCapture).Thumbnail(id, saver.name);
}

/*****************************************************************************************/
// The following are all messages sent from outside, to change a property of this object.
// e.g., from browser-based property editors using GetUnity().SentMessage(path, functionName, singleArgument).
// SendMessage in the browser can only send one (String) argument (other than the path), so we need separate functions 
// for each of these.
function setPositionX(v:String) {var vec = transform.position; transform.position = Vector3(parseFloat(v), vec.y, vec.z); saveScene('slide x');}
function setPositionY(v:String) {var vec = transform.position; transform.position = Vector3(vec.x, parseFloat(v), vec.z); saveScene('slide y');}
function setPositionZ(v:String) {var vec = transform.position; transform.position = Vector3(vec.x, vec.y, parseFloat(v)); saveScene('slide z');}

function setRotationX(v:String) {var vec = transform.eulerAngles; transform.eulerAngles = Vector3(parseFloat(v), vec.y, vec.z); saveScene('rotate x');}
function setRotationY(v:String) {var vec = transform.eulerAngles; transform.eulerAngles = Vector3(vec.x, parseFloat(v), vec.z); saveScene('rotate y');}
function setRotationZ(v:String) {var vec = transform.eulerAngles; transform.eulerAngles = Vector3(vec.x, vec.y, parseFloat(v)); saveScene('rotate z');}

function setScale(v:String, index:int) {
	var dbg = 'set v:' + v + ' i:' + index.ToString();
	var global = transform.lossyScale; 
	dbg += ' lossy:' + global.ToString();
	global[index] = parseFloat(v);
	dbg += ' now:' + global.ToString();
	var reorientedGlobal = transform.parent.InverseTransformDirection(global);
	dbg += ' transfd:' + reorientedGlobal.ToString();
	transform.localScale = reorientedGlobal;
	dbg += ' new:' + transform.lossyScale.ToString();
	Application.ExternalCall('notifyUser', dbg);
	saveScene('scale');
}
function setScaleX(v:String) {setScale(v, 0);}
function setScaleY(v:String) {setScale(v, 1);}
function setScaleZ(v:String) {setScale(v, 2);}
