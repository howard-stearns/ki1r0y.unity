// Turns off mouse look when the mouse leaves the player.
// Attach this script to a GUITexture that covers the player, but which has no texture.
public var looks:MouseLook[];

// Doesn't work on iPhone, but neither is it needed.
function OnMouseEnter() {
    for (var script:MouseLook in looks) script.enabled = true;
}
function OnMouseExit() {
    for (var script:MouseLook in looks) script.enabled = false;
}

function Update() {
	if (Input.GetKeyUp(KeyCode.Escape)) {
		for (var script:MouseLook in looks) script.enabled = false;
	}
}