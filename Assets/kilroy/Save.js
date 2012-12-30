function Log(s:String) {
	//Debug.Log('Save: ' + s); 
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
	var www = WWW('http://beyondmywall.fe100.net/db/' + id, form);
	yield www;
	if (www.error) print('upload ' + id + ' failed ' + www.error);
	else Log(id + ' uploaded as ' + www.text);
}

function asData(x:GameObject):Hashtable {
	var shared = new Hashtable(); // Common data for all instances of this object.
	AddProperty(shared, 'name', x.name);
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

// Answers the id of this group. Side effects include:
//   Uploads data to id IFF needed.
//   Updates Obj.hash (so we can tell later if a new upload is needed).
//   Updates Obj.id (to the new hash) IFF it was empty.
// FIXME: (In Restore.js) Scenes always need upload after change, so there's no point
// in initializing their Obj.hash when restoring. However, that's not true for other groups.
function PersistGroup(x:GameObject):String {
	var obj:Obj = x.GetComponent(Obj);
	var serialized = asString(x);
	var hash = Utils.sha1(serialized);
	if (obj.id == 'G') obj.id = 'G' + System.Guid.NewGuid().ToString(); // New object => new id. 
	if (hash == obj.hash) return obj.id; // No need to upload.
	uploadData(obj.id, hash, serialized);
	obj.hash = hash;
	return obj.id;
}
function Persist(x:GameObject):Hashtable {
	if (!enabled) return new Hashtable();  // for debugging/experiments
	var obj:Obj = x.GetComponent(Obj);
	var id:String;
	if (obj.id[0] == 'G'[0]) { // FIXME: there's some duplication between these branches.
		id = PersistGroup(x);
	} else {
		var serialized = asString(x);
		id = Utils.sha1(serialized);
		if (id != obj.id) {
			uploadData(id, id, serialized);
			obj.id = id;
		}
	}
	// Report only this particular instance data to caller.
	var instance = new Hashtable(); 
	AddProperty(instance, 'id', id);
	if (x.transform.localPosition != Vector3.zero) 
		AddProperty(instance, 'position', x.transform.localPosition);
	if (x.transform.localRotation != Quaternion.identity)
		AddProperty(instance, 'rotation', x.transform.localRotation);
	if (x.transform.localScale != Vector3.one)
		AddProperty(instance, 'scale', x.transform.localScale);
	return instance;
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
	AddProperty(p, 'type', component.sharedMesh.name);
}
// Todo: Renderer: list materials[n].mainTexture
function AddComponent(p:Hashtable, component:Light) {
	AddProperty(p, 'type', component.type.ToString());
	AddProperty(p, 'intensity', component.intensity);
}
function AddComponent(p:Hashtable, component:Component) {
}