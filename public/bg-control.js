/* Floating background and side-decoration control
	 Adds a small UI to set the page background and the side decoration image.
	 Presets assume files placed under public/multimedia/Fotos/:
		 - multimedia/Fotos/chatgpt.jpg  (example main background)
		 - multimedia/Fotos/drone-sides.jpg (the attached drone artwork to show on sides)
	 The user can also upload an image; the upload sets both the main background and the side decoration
	 (session-only, stored as data URL). */

(function(){
	if (document.querySelector('.bg-switcher')) return; // already added
	const wrapper = document.createElement('div');
	wrapper.className = 'bg-switcher';

	const panel = document.createElement('div');
	panel.className = 'panel';

	const title = document.createElement('div');
	title.style.fontWeight = '700';
	title.style.marginBottom = '8px';
	title.textContent = 'Fondo y decoración';
	panel.appendChild(title);

	// Preset for main background
	const presetLabel = document.createElement('label');
	presetLabel.textContent = 'Usar imagen del proyecto';
	const presetBtn = document.createElement('button');
	presetBtn.className = 'btn-mini';
	presetBtn.style.marginBottom = '6px';
	presetBtn.textContent = 'Usar: multimedia/Fotos/chatgpt.jpg';
	presetBtn.addEventListener('click', () => {
		document.documentElement.style.setProperty('--bg-image', "url('multimedia/Fotos/chatgpt.jpg')");
		updatePreview();
	});
	panel.appendChild(presetLabel);
	panel.appendChild(presetBtn);

	// Preset for side decoration (drone artwork)
	const sidesLabel = document.createElement('label');
	sidesLabel.textContent = 'Decoración lateral';
	const sidesBtn = document.createElement('button');
	sidesBtn.className = 'btn-mini';
	sidesBtn.style.marginBottom = '6px';
	sidesBtn.textContent = 'Usar: multimedia/Fotos/drone-sides.jpg';
	sidesBtn.addEventListener('click', () => {
		document.documentElement.style.setProperty('--sides-image', "url('multimedia/Fotos/drone-sides.jpg')");
		updatePreview();
	});
	panel.appendChild(sidesLabel);
	panel.appendChild(sidesBtn);

	// Upload control
	const upLabel = document.createElement('label'); upLabel.textContent = 'Subir imagen (aplica a fondo y laterales)';
	const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*';
	fileInput.addEventListener('change', (e) => {
		const f = e.target.files && e.target.files[0];
		if (!f) return;
		const reader = new FileReader();
		reader.onload = () => {
			const url = `url('${reader.result}')`;
			document.documentElement.style.setProperty('--bg-image', url);
			document.documentElement.style.setProperty('--sides-image', url);
			updatePreview();
		};
		reader.readAsDataURL(f);
	});
	panel.appendChild(upLabel);
	panel.appendChild(fileInput);

	// Reset button
	const resetBtn = document.createElement('button');
	resetBtn.className = 'btn-mini';
	resetBtn.style.marginTop = '8px';
	resetBtn.textContent = 'Restablecer';
	resetBtn.addEventListener('click', () => {
		document.documentElement.style.setProperty('--bg-image', 'none');
		document.documentElement.style.setProperty('--sides-image', 'none');
		updatePreview();
	});
	panel.appendChild(resetBtn);

	// Preview box
	const preview = document.createElement('div');
	preview.className = 'preview';
	preview.style.marginTop = '8px';
	panel.appendChild(preview);

	function updatePreview() {
		const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-image').trim();
		const sides = getComputedStyle(document.documentElement).getPropertyValue('--sides-image').trim();
		if (!bg || bg === 'none') preview.style.backgroundImage = 'linear-gradient(90deg, rgba(0,0,0,0.02), rgba(0,0,0,0.01))';
		else preview.style.backgroundImage = bg;
		preview.style.boxShadow = (sides && sides !== 'none') ? 'inset 0 0 0 2px rgba(0,0,0,0.04)' : 'none';
	}

	wrapper.appendChild(panel);
	document.body.appendChild(wrapper);

	// Initialize preview from current CSS variables
	updatePreview();
})();

