#pragma strict

function OnMouseEnter () {
	transform.parent.gameObject.GetComponent.<Adjust>().OnMouseEnter();
}
function OnMouseExit () {
	transform.parent.gameObject.GetComponent.<Adjust>().OnMouseExit();
}
function setColor(color:Color) { renderer.material.color = color; }