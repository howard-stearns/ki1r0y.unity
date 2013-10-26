#pragma strict

public var adjusterPrefab:Transform;

function OnMouseEnter () {
	Debug.Log('enter ' + transform + ' parent ' + transform.parent);
	Sticky.AddAdjuster(transform.parent, adjusterPrefab);
}

function OnMouseExit () {
	Debug.Log('exit ' + transform + ' parent ' + transform.parent);
}