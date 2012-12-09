class Persist extends Hashtable {
	function Persist(x:GameObject) {
		Debug.Log('Persisting ' + x.name);
		this.AddProperty('name', x.name);
		// THIS DOES NOT WORK!!!!
		// Even though component is typed as Object, the compiler always
		// picks the Component overload of AddComponent.
		// Doing exactly the same thing in a MonoBehavior instead of a Hashtable, DOES work.
		for (var component:Object in x.GetComponents(typeof Component)) {
			Debug.Log('adding component ' + component.GetType().Name);
			this.AddComponent(component);
		}
	}

	function AddProperty (key:String, x) {
		Debug.Log(key + ':' + x);
		this[key] = x;
	}
	function AddProperty (key:String, v:Vector3) {
		this.AddProperty(key, {'x':v.x, 'y':v.y, 'z':v.z});
	}
	function AddProperty (key:String, q:Quaternion) {
		this.AddProperty(key, {'x':q.x, 'y':q.y, 'z':q.z, 'w':q.w});
	}
	
	function AddComponent(component:Transform) {
		Debug.Log('adding transform');
		this.AddProperty('position', component.localPosition);
		this.AddProperty('rotation', component.localRotation);
		this.AddProperty('scale', component.localScale);
		var children:Array = [];
		for (var child:Transform in component) {
			var persisted = new Persist(child.gameObject);
			if (persisted.Count != 0)
				children.Push(persisted);
		}
		if (children.length != 0)
			this.AddProperty('children', children);
	}
	function AddComponent(component:MeshFilter) {
		Debug.Log('adding mesh type ' + component.sharedMesh.name);
		this.AddProperty('type', component.sharedMesh.name);
	}
	function AddComponent(component:Component) {
		Debug.Log('Doing nothing for ' + component.GetType().Name);
	}
	
	function Serialize():String {
		return JSON.Stringify(this);
	}
}
