function Log(s:String) {
	//Debug.Log('Save: ' + s); 
}

public static var userId = '100004567501627';
public static var host = 'localhost:3000';
function ContactInfo(combo:String) {
	var stupidNETcharArray:char[] = ['/'[0]];
	var pair = combo.Split(stupidNETcharArray);
	host = pair[0];
	userId = pair[1];
	Application.ExternalCall('notifyUser', 'ContactInfo host:' + host + ' userId:' + userId);
}
function uploadData(id:String, hash:String, serialized:String) {
	// Must be separate void function to be yieldable.
 	Log(id + ': ' + serialized); // simulated upload
 	var form = new WWWForm();
	form.AddField('data', serialized);
	// For groups, the hash is not the same as id, and saves on uploads later if we do persist the hash.
	// That's just an optimization, and the server is not required to actually save the hash.
	// Note that the hash cannot be part of the serialized data, as then the hash would be 
	// circularly dependendant on its own value.
	if (hash != id) form.AddField('hash', hash);
	var www = WWW('http://' + host + '/db/' + id, form);
	yield www;
	if (www.error) print('upload ' + id + ' failed ' + www.error);
	else Log(id + ' uploaded as ' + www.text);
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
	
	AddProperty(p, 'nametag', component.nametag);
	AddProperty(p, 'author', component.author);
}
function AddComponent(p:Hashtable, component:Transform) {
	// The only shared data for all instances is the child data.
	// The instance-specific transform data (position/rotation/scale) is above.
	var children:Array = [];
	for (var child:Transform in component) {
		var persisted:Hashtable = Persist(child.gameObject);
		if (persisted.Count != 0)
			children.Push(persisted);
	}
	if (children.length != 0)
		AddProperty(p, 'children', children);
}
function AddComponent(p:Hashtable, component:MeshFilter) {
	var type = component.sharedMesh.name;
	// When a prefab gets frobbed, the name changes from 'Foo' to 'Foo instance'.
	// We don't want that. (IWBNI we tracked that down.)
	var index = type.IndexOf(' Instance');
	if (index >= 0) type = type.Remove(index);
	AddProperty(p, 'type', type);
}
function AddComponent(p:Hashtable, component:Renderer) {
	var mats:Array = []; var any = false;
	for (var mat in component.sharedMaterials) {
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
	if (any) AddProperty(p, 'materials', mats);
}
function AddComponent(p:Hashtable, component:Light) {
	AddProperty(p, 'type', component.type.ToString());
	AddProperty(p, 'intensity', component.intensity);
}
function AddComponent(p:Hashtable, component:Component) {
}

static function JSTime() {
	return System.Math.Round((System.DateTime.UtcNow - new System.DateTime(1970,1,1)).TotalMilliseconds);
}

public var forceUpload = false; // forces upload even if not changed. Used for regenerating db.
// Answers the id of this group. Side effects include:
//   Uploads data to id IFF needed.
//   Updates Obj.hash (so we can tell later if a new upload is needed).
//   Updates Obj.id IFF it was empty.
function PersistGroup(x:GameObject):String {
	var obj:Obj = x.GetComponent(Obj);
	var serialized = asString(x);
	var hash = Utils.sha1(serialized);
	if (obj.id == 'G') obj.id = 'G' + System.Guid.NewGuid().ToString(); // New object => new id. 
	if (!forceUpload && (hash == obj.hash)) return obj.hash; // No need to upload.
	// Upload the data needed to rebuild this version of the object.
	uploadData(hash, hash, serialized);

	// Update the local and persisted group info.
	if (!obj.versions) obj.versions = {};
	obj.timestamp = JSTime().ToString();
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
		'nametag': obj.nametag, // Including it here saves work when serving people pages
		'versions': obj.versions
		});
	uploadData(obj.id, Utils.sha1(groupSerialization), groupSerialization);
	obj.hash = hash;
	return obj.hash;
}
function Persist(x:GameObject):Hashtable {
	var instance = new Hashtable(); 
	var obj:Obj = x.GetComponent(Obj);
	if (!enabled || obj == null) return new Hashtable();  // for debugging/experiments
	if (obj.isGroup()) {
		var hash = PersistGroup(x);
		AddProperty(instance, 'idvtag', hash); // Restore must grab the hash data, not the latest.
		// Individual version data does not (currently) have general group nametag, so include it here.
		AddProperty(instance, 'idtag', obj.id); 
	} else {
		var serialized = asString(x);
		id = Utils.sha1(serialized);
		if (forceUpload || (id != obj.id)) {
			uploadData(id, id, serialized);
			obj.id = id;
		}
		AddProperty(instance, 'idtag', id);
	}
	if (x.transform.localPosition != Vector3.zero) 
		AddProperty(instance, 'position', x.transform.localPosition);
	if (x.transform.localRotation != Quaternion.identity)
		AddProperty(instance, 'rotation', x.transform.localRotation);
	if (x.transform.localScale != Vector3.one)
		AddProperty(instance, 'scale', x.transform.localScale);
	return instance;
}