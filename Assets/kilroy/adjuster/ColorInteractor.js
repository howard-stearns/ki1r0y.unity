#pragma strict
// The affordance GameObject should have:
// * a (e.g., Mesh) Renderer. (Probably don't need to cast or receive shadows.) The renderer can be in a child if setColor() is defined there.
// * a transparent/vertex-lit material. (Kilroy uses Materials/translucent.)
//
// It is common, but not required, for the affordance (and the whole gizmo it is attached to) to be on a HUD layer that draws
// over the top of the object, even when the affordance is precisely on the surface of the object or when the gizmo is centered within the object.
// (That's why it is common for the affordance material to make use of alpha.)
// If the gizmo is on the HUD layer, the scene should have a HUD Camera attached to the Main Camera so that both layers are drawn.

class ColorInteractor extends Interactor {
	
// Use highlightColor when hot (moused over), and normalColor otherwise.
function OnMouseEnter() {	
	super.OnMouseEnter();
	if (!isMoving) { setAffordanceColor(highlightColor); }  // Won't be isMoving if something else passes in front of us
}
function OnMouseExit() {
	super.OnMouseExit();  
	if (!isMoving) { setAffordanceColor(normalColor); }
}

public var highlightColor:Color;	// subclasses or instances must set
public var normalColor:Color;  		// defaults to a muted version of highlighColor
public var targetAlpha:float = 0.9;

// This is broadcast to gameObject and children. Thus children of affordances can change color if they define this message.
public function setColor(color:Color) { if (GetComponent.<Renderer>()) { GetComponent.<Renderer>().material.color = color; } }
public function setAffordanceColor(color:Color) { BroadcastMessage('setColor', color, SendMessageOptions.DontRequireReceiver); }

public function makeAlpha(rgb:Vector3):Color {
	var colorVector:Vector4 = rgb;
	colorVector.w = targetAlpha;
	return colorVector;
}
function Awake() {
	// highlightColor must be already set.
	if (normalColor == Color.clear) { normalColor = highlightColor / 1.33; }
	setAffordanceColor(normalColor);
	super.Awake();
}
}