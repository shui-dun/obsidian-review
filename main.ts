import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, FrontMatterCache } from 'obsidian';

var updateEase = async function (file: TFile, foo: Function) {
	// 获得frontmatter
	let frontmatter = this.app.metadataCache.getFileCache(file).frontmatter;
	// 读取文件内容
	let fileText: string = await this.app.vault.read(file);
	// 从frontmatter中读取复习的难易度和复习间隔
	let [originEase, originInterval] = frontmatter["review"];
	// 更新复习的难易度和复习间隔，easy、good、hard、start over的策略各不相同
	let [destEase, destInterval] = foo(originEase, originInterval);
	// 只保留两位小数
	destEase = Number(destEase).toFixed(2);
	destInterval = Number(destInterval).toFixed(2);
	// 更新frontmatter
	fileText = fileText.replace(/(\-\-\-[\s\S]+?review:\s+\[\s*)[\.\d]+\s*,\s*[\.\d]+\s*(\][\s\S]+?\-\-\-)/, `$1${destEase}, ${destInterval}$2`);
	// 写入文件
	this.app.vault.modify(file, fileText);
	// 弹出通知
	new Notice(`ease: from ${originEase} to ${destEase}\ninterval: from ${originInterval} to ${destInterval}`);
}

export default class MyPlugin extends Plugin {

	async onload() {

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file: TAbstractFile) => {
				if (file instanceof TFile && file.extension === "md") {
					menu.addItem((item) => {
						item
							.setTitle("Review: feels easy 😁")
							.setIcon("document")
							.onClick(async () => {
								updateEase(file, (ease: number, interval: number) => [ease * 1.2, interval * ease * 1.3]);
							});
					});
					menu.addItem((item) => {
						item
							.setTitle("Review: feels good 🙂")
							.setIcon("document")
							.onClick(async () => {
								updateEase(file, (ease: number, interval: number) => [ease * 1.05, interval * ease]);
							});
					});
					menu.addItem((item) => {
						item
							.setTitle("Review: feels hard 😭")
							.setIcon("document")
							.onClick(async () => {
								updateEase(file, (ease: number, interval: number) => [ease * 0.85 < 1.3 ? 1.3 : ease * 0.85, interval * 1.2]);
							});
					});
					menu.addItem((item) => {
						item
							.setTitle("Review: start over 💀")
							.setIcon("document")
							.onClick(async () => {
								updateEase(file, (ease: number, interval: number) => [ease * 0.8 < 1.3 ? 1.3 : ease * 0.8, 10]);
							});
					});
				}
			})
		);

	}

	onunload() {

	}

}
