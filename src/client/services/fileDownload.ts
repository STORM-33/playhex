const downloadString = (content: string, filename: string, mimeType = 'text/plain'): void => {
    const a = document.createElement('a');
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();
};

const downloadBlob = (blob: Blob, filename: string): void => {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();
    URL.revokeObjectURL(url);
};

export {
    downloadString,
    downloadBlob,
};
