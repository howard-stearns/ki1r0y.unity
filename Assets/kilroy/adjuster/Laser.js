#pragma strict
// Handles Interactor's StartInteraction(), UpdateInteraction, EndInteraction() by drawing a laser.

function between(verticalObject:GameObject, p1:Vector3, p2:Vector3, width:float) {
	var offsetToCenter:Vector3 = (p1 - p2) / 2.0;
	verticalObject.transform.position = p1 - offsetToCenter;
	verticalObject.transform.up = p2 - p1;
	verticalObject.transform.localScale = Vector3(width, offsetToCenter.magnitude, width);
}
public var laserPrefab:Transform;
public var laser:GameObject;

function UpdateInteraction(point:Vector3) {
	between(laser, transform.position, point, 0.1);
}
function StartInteraction(point:Vector3, object:Transform) {
	laser = Instantiate(laserPrefab.gameObject);
	UpdateInteraction(point);
	laser.transform.parent = transform;
	Screen.showCursor = false;
}
function EndInteraction() {
	Screen.showCursor = true;
	if (!!laser) {
		laser.transform.parent = null; 
		Destroy(laser);
		laser = null;
	}
}