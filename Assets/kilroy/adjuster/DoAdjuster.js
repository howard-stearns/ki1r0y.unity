#pragma strict

// When added to an Obj.mesh (e.g., the Cube, Plane, or Mesh collider child of a Kilroy Obj),
// this ensures that our standard Adjuster is added to whatever the mouse is over.

public var adjusterPrefab:Transform; // Prototype Adjuster, which uses the Sticky script.

function OnMouseEnter () {
	//Debug.Log('enter ' + gameObject);
	Sticky.AddAdjuster(transform.parent, adjusterPrefab); // Removes an previous.
}

//function OnMouseExit () { Debug.Log('exit ' + gameObject); }