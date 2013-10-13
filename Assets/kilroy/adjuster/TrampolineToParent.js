#pragma strict
// For use with the Directional script, when the visible affordances are children of the object that carries the
// Directional subclass component. 
function OnMouseEnter () {
	transform.parent.gameObject.GetComponent.<Adjust>().OnMouseEnter();
}
function OnMouseExit () {
	transform.parent.gameObject.GetComponent.<Adjust>().OnMouseExit();
}
function setColor(color:Color) { renderer.material.color = color; }