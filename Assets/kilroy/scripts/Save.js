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
	Application.ExternalCall('notifyUser', 'combo:' + combo + ' host:' + host + ' userId:' + userId);
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
	
	AddProperty(p, 'name', component.nametag);
	AddProperty(p, 'author', component.author);
	AddProperty(p, 'created', component.created);
	if (component.modified != 0.0d) AddProperty(p, 'modified', component.modified);
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
	return (System.DateTime.UtcNow - new System.DateTime(1970,1,1)).TotalMilliseconds;
}

// Answers the id of this group. Side effects include:
//   Uploads data to id IFF needed.
//   Updates Obj.hash (so we can tell later if a new upload is needed).
//   Updates Obj.id (to the new hash) IFF it was empty.
function PersistGroup(x:GameObject):String {
	var obj:Obj = x.GetComponent(Obj);
	obj.modified = JSTime();  // FIXME: modified cannot be part of hash!
	var serialized = asString(x);
	var hash = Utils.sha1(serialized);
	if (obj.id == 'G') obj.id = 'G' + System.Guid.NewGuid().ToString(); // New object => new id. 
	if (hash == obj.hash) return obj.id; // No need to upload.
	// This can be optimized. Right now, the group and object are uploaded and downloaded
	// as two different urls. The group and object could be combined to reduce http ops.
	uploadData(hash, hash, serialized);
	var groupSerialization = JSON.Stringify({'hash': hash});
	uploadData(obj.id, Utils.sha1(groupSerialization), groupSerialization);
	obj.hash = hash;
	return obj.hash;
}
function Persist(x:GameObject):Hashtable {
	var instance = new Hashtable(); 
	var obj:Obj = x.GetComponent(Obj);
	if (!enabled || obj == null) return new Hashtable();  // for debugging/experiments
	var id:String;
	if (obj.isGroup()) { // FIXME: there's some duplication between these branches.
		var hash = PersistGroup(x);
		AddProperty(instance, 'hash', hash);
		id = x.name;
	} else {
		var serialized = asString(x);
		id = Utils.sha1(serialized);
		if (id != obj.id) {
			uploadData(id, id, serialized);
			obj.id = id;
		}
	}
	// Report only this particular instance data to caller.
	AddProperty(instance, 'id', id);
	if (x.transform.localPosition != Vector3.zero) 
		AddProperty(instance, 'position', x.transform.localPosition);
	if (x.transform.localRotation != Quaternion.identity)
		AddProperty(instance, 'rotation', x.transform.localRotation);
	if (x.transform.localScale != Vector3.one)
		AddProperty(instance, 'scale', x.transform.localScale);
	return instance;
}