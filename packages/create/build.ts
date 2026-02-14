import fs from 'fs-extra';

function copyTemplates() {
    return fs.copy('./templates', './assets');
}

copyTemplates()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
