function Log(s:String) {
	//Debug.Log('Save: ' + s); 
}
public static function splitPath(path:String, sep:String) {
	var stupidNETcharArray:char[] = [sep[0]];
	return path.Split(stupidNETcharArray);
}
public static function splitPath(path:String) { return splitPath(path, '/'); }

public static var userId = '100004567501627';
public static var host = 'localhost:3000';
function ContactInfo(combo:String) {
	var pair = splitPath(combo);
	host = pair[0];
	userId = pair[1];
	Application.ExternalCall('notifyUser', 'ContactInfo host:' + host + ' userId:' + userId);
}

// It is much easier for us to debug code, and for users to match things up, when all
// of the timestamps from a save are the same. This instance var is set by PersistScene
public var thisTimestamp = '';  // FIXME: should pass this around (rather than global) in case of overlapping saves.
public var lastSaveObj:Obj; var lastSaveAction = '';
public var refs = {}; // A set of all the objects referenced by this scene.
public var changes = new Array(); // The idvtags of everything that changed, so that we can set a thumbnail.
var outstanding = 0;
function uploadData(id:String, hash:String, serialized:String, mode:String) {
	// Must be separate void function to be yieldable.
	var logId = id + ':' + mode + ': ';
 	Log(logId + serialized); 
 	outstanding++;
 	var form = new WWWForm();
	form.AddField('data', serialized);
	// For groups, the hash is not the same as id, and saves on uploads later if we do persist the hash.
	// That's just an optimization, and the server is not required to actually save the hash.
	// Note that the hash cannot be part of the serialized data, as then the hash would be 
	// circularly dependendant on its own value.
	// if (hash != id) form.AddField('hash', hash);
	var www = new WWW('http://' + host + '/' + mode + '/' + id, form);
	yield www;
	// FIXME: Unity post error messages are stupid.
	if (!String.IsNullOrEmpty(www.error)) Application.ExternalCall('errorMessage', 'Save ' + id + ' failed:' + www.error);
	else Log(logId + ' uploaded ' + www.text);
	if (!--outstanding) { 
		refs = {};
		StartCoroutine( lastSaveObj.savedScene(lastSaveAction, changes) );
		changes = new Array();
	}
}

function asData(x:GameObject):Hashtable {
	var shared = new Hashtable(); // Common data for all instances of this object.
	// The component var is deliberately untyped, else the compiler will
	// be too clever by half and ALWAYS pick the Component overload!
	for (var component:Object in x.GetComponents(typeof Component)) {
		AddComponent(shared, component);
	}
	return shared;
}
function asString(x:GameObject):String {
	return JSON.Stringify(asData(x));
}

function AddProperty (p:Hashtable, key:String, x) {
	p[key] = x;
}
function AddProperty (p:Hashtable, key:String, v:Vector3) {
	AddProperty(p, key, {'x':v.x, 'y':v.y, 'z':v.z});
}
function AddProperty (p:Hashtable, key:String, q:Quaternion) {
	AddProperty(p, key, {'x':q.x, 'y':q.y, 'z':q.z, 'w':q.w});
}

function AddComponent(p:Hashtable, component:Obj) {
	// FIXME: if obj.author doesn't match our userId, then create a new object.
	
	if (component.nametag == '') component.nametag = component.name; // Just for bootstrapping. FIXME remove.
	if (component.author == '') component.author = userId;
	
	AddProperty(p, 'type', component.kind);
	AddProperty(p, 'nametag', component.nametag);
	AddProperty(p, 'author', component.author);
	// Save obj.sharedMaterials() here, rather than letting Renderer component do it on its own, 
	// because Obj component may indirect sharedMaterials in different ways.
	var mats:Array = []; var any = false;
	if (component.kind == 'Mesh') {
		var path = splitPath(component.mesh.GetComponent.<ObjMesh>().objPath);
		AddProperty(p, 'mesh', path[path.length - 1]);  // Specifies materials within data at objPath.
	} else {
		for (var mat in component.sharedMaterials()) {
			var txt = mat.mainTexture;
			if (txt == null) {
				mats.Push('');
				continue;
			}
			any = true;
			// We can't add our own scripts and properties (e.g., id and hash) to 
			// materials and textures. However, we can treat them as immutable, and
			// arrange to make sure that they are always given a unique name and
			// uploaded at creation time. All we have to do here is just include that
			// name, and we never have to worry about potentially slow texture uploads 
			// during scene saves. 
			// FIXME: encode other properties (scale, offset).
			mats.Push(txt.name);
		}
	}
	if (any) AddProperty(p, 'materials', mats);
}
function AddComponent(p:Hashtable, component:Transform) {
	// The only shared data for all instances is the child data.
	// The instance-specific transform data (position/rotation/scale) is above.
	var children:Array = [];
	for (var child:Transform in component) {
		var persisted:Hashtable = Persist(child.gameObject);
		if (persisted.Count != 0) children.Push(persisted);
	}
	if (children.length != 0)
		AddProperty(p, 'children', children);
}
function AddComponent(p:Hashtable, component:Light) {
	//AddProperty(p, 'type', component.type.ToString());
	AddProperty(p, 'intensity', component.intensity);
}
function AddComponent(p:Hashtable, component:Component) {
}

public var forceUpload = false; // forces upload even if not changed. Used for regenerating db.
// Answers the id of this group. Side effects include:
//   Uploads data to id IFF needed.
//   Updates Obj.hash (so we can tell later if a new upload is needed).
//   Updates Obj.id IFF it was empty.
function PersistGroup(x:GameObject):String {
	var obj:Obj = x.GetComponent.<Obj>();
	var serialized = asString(x);
	var hash = Utils.sha1(serialized);
	if (obj.id == 'G') obj.id = 'G' + System.Guid.NewGuid().ToString(); // New object => new id. 
	if (!forceUpload && (hash == obj.hash)) return obj.hash; // No need to upload.
	// Upload the data needed to rebuild this version of the object.
	StartCoroutine( uploadData(hash, hash, serialized, "thing") );
	changes.Push(hash); // the versioned (hash) id gets noted for a thumbnail upload.

	// Update the local and persisted group info.
	if (!obj.versions) obj.versions = {};
	obj.timestamp = thisTimestamp;
	obj.versions[obj.timestamp] = hash;  // adds current version

	// Trim older versions. We have to gracefully handle requests for expired versions
	// that were captured from browser histories. Given that capability, there's
	// no reason to worry here about whether removing a version that is "live"
	// in some long-running session.
	var vers = {}; 
	var keys = obj.timestamps();
	// We could keep different amounts for different time periods.
	// Right now, we just keep the 10 most recent.
	var bottom = System.Math.Max(0, keys.Count - 10);
	for (var i = keys.Count - 1; i >= bottom; i--) { // working backwards from most recent
		var key = keys[i];
		var val = obj.versions[key];
		//Debug.Log(obj.id + ' copying version ' + val + ' at ' + key);
		vers[key] = val;
	}
	obj.versions = vers;
	
	// Now upload the group container data, so that it can be referenced by id to get whatever the latest version is.
	var groupSerialization = JSON.Stringify({
		'idvtag': hash,
		'nametag': obj.nametag, // Including it here saves work when serving initial related results
		'author': obj.author, // ditto
		'versions': obj.versions
		});
	StartCoroutine( uploadData(obj.id, Utils.sha1(groupSerialization), groupSerialization, 'place') ); // FIXME we're not really using the sha1. Remove?
	obj.hash = hash;
	return obj.hash;
}
function Persist(x:GameObject):Hashtable { return Persist(x, false); }
function Persist(x:GameObject, isScene:boolean):Hashtable {
	var instance = new Hashtable(); 
	var obj:Obj = x.GetComponent.<Obj>();
	if (!enabled || obj == null || !obj.enabled) return new Hashtable();  // for debugging, experiments, and deleted objects
	if (obj.isGroup()) {
		var hash = PersistGroup(x);
		AddProperty(instance, 'idvtag', hash); // Restore must grab the hash data, not the latest.
		// Individual version data does not (currently) have general group nametag, so include it here.
		AddProperty(instance, 'idtag', obj.id); 
	} else {
		var serialized = asString(x);
		id = Utils.sha1(serialized);
		if (forceUpload || (id != obj.id)) {
			StartCoroutine( uploadData(id, id, serialized, 'thing') );
			obj.id = id;
			changes.Push(obj.id);
		}
		AddProperty(instance, 'idtag', id);
	}
	// Make sure that the Unity name matches the (possibly new) obj.id, so that Find works.
	x.name = obj.id;
	if (isScene) {
		// We could optimize the number of POSTs by adding a parameter to the scene data, but for now...
		StartCoroutine( uploadData(obj.id, obj.hash, JSON.Stringify(new Array(refs.Keys)), 'refs') );
	} else {
		refs[obj.id] = true; // accumulate one each of all the refs as we trace.
	}
	if (x.transform.localPosition != Vector3.zero) 
		AddProperty(instance, 'position', x.transform.localPosition);
	if (x.transform.localRotation != Quaternion.identity)
		AddProperty(instance, 'rotation', x.transform.localRotation);
	var size = obj.size();
	if (size != Vector3.one) AddProperty(instance, 'size', size);
	return instance;
}

static function JSTime() { // return the same value of new Date().getTime() would in Javascript.
	return System.Math.Round((System.DateTime.UtcNow - new System.DateTime(1970,1,1)).TotalMilliseconds);
}
// Persist (only) everything we need to in the attached scene, answering the timestamp.
// Media (e.g., textures) are uploaded at import time, and don't have any impact on this save.
// We are given the obj that has changed, so we could bubble up if we were sure nothing else has changed.
// For now, though, we persist from our gameObject down -- we are attached to the scene -- to make sure we catch everything.
// This function is synchronous (answering timestamp), but we also send obj.SavedScene(action) when we are sure
// that everything is asynchronously uploaded. (That way, the browser can be sure that thumbnails are available.)
// If there are multiple overlapping attempts to save, each saving obj will be told the correct timestamp synchronously, 
// and all the uploads (including thumbnails) will happen, but obj.SavedScene will only be sent once when everything is ready.
// (The refs dictionary could have extra stuff if there is a deletion during a save, but that's ok. We'll eliminate it next time.)
function PersistScene(obj:Obj, action:String) { 
	thisTimestamp = JSTime().ToString();
	lastSaveObj = obj;
	lastSaveAction = action;
	Persist(gameObject, true);
	return thisTimestamp;
}