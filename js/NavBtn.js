import { UIComponent } from './UIComponent.js';

export class ActionButton extends UIComponent {
    constructor(text, className, iconSrc = null, onClick = null) {
        super('button', { className: className });
        
        // Add text
        this.element.textContent = text;

        // If an image is provided, create it and append it
        if (iconSrc) {
            const icon = new UIComponent('img', { src: iconSrc, alt: 'icon' });
            this.element.appendChild(icon.element);
        }

        // Attach click event
        if (onClick) {
            this.on('click', onClick);
        }
    }
}