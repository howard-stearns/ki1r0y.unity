function Log(s:String) {
	//Debug.Log('Save: ' + s); 
}
function sha1(serialized:String) {
	var sb = new System.Text.StringBuilder();
	var bytes = System.Text.Encoding.ASCII.GetBytes(serialized);
  	for (var byteChunk in System.Security.Cryptography.SHA1.Create().ComputeHash(bytes)) 
    	sb.Append(byteChunk.ToString("x2"));
  	return sb.ToString();
}
function uploadData(hash:String, serialized:String) {
	// Must be separate void function to be yieldable.
 	Log(hash + ': ' + serialized); // simulated upload
 	var form = new WWWForm();
	form.AddField('data', serialized);
	var www = WWW('http://beyondmywall.fe100.net/db/' + hash, form);
	yield www;
	if (www.error) print('upload ' + hash + ' failed ' + www.error);
	else Log(hash + ' uploaded as ' + www.text);
}
function store(key:String, data:Hashtable):String {
	var serialized = JSON.Stringify(data);
	if (key == '') key = sha1(serialized);
	uploadData(key, serialized);
  	return key;
}
function store(data:Hashtable):String { // answer hash
	return store('', data);
}

function Persist(x:GameObject):Hashtable {
	var shared = new Hashtable(); // Common data for all instances of this object.
	AddProperty(shared, 'name', x.name);
	// The component var is deliberately untyped, else the compiler will
	// be too clever by half and ALWAYS pick the Component overload!
	for (var component:Object in x.GetComponents(typeof Component)) {
		AddComponent(shared, component);
	}
	var hash = store(shared);
	// Report only this particular instance data to caller.
	var instance = new Hashtable(); 
	AddProperty(instance, 'id', hash);
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

function Start () {
	yield WaitForSeconds(6);
	var p = Persist(gameObject);
	Debug.Log('top level save ' + JSON.Stringify(p));
}