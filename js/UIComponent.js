export class UIComponent {
    constructor(tag, attributes = {}, children = []) {
        this.element = document.createElement(tag);

        // Apply attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') this.element.className = value;
            else if (key === 'id') this.element.id = value;
            else if (key === 'textContent') this.element.textContent = value;
            else if (key === 'innerHTML') this.element.innerHTML = value;
            else this.element.setAttribute(key, value);
        });

        // Append nested children components
        children.forEach(child => {
            if (child instanceof UIComponent) {
                this.element.appendChild(child.element);
            }
        });
    }

    // Attach an event listener
    on(event, callback) {
        this.element.addEventListener(event, callback);
        return this; // Allows for chaining
    }

    // Render this component into a parent DOM node
    mount(parentDOMNode) {
        parentDOMNode.appendChild(this.element);
    }
}