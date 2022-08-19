import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, FrontMatterCache } from 'obsidian';

export default class MyPlugin extends Plugin {

	async onload() {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file: TAbstractFile) => {
				if (file instanceof TFile && file.extension === "md") {
					menu.addItem((item) => {
						item
							.setTitle("Review: 容易 😁")
							.setIcon("document")
							.onClick(async () => {
								this.updateReviewInFrontMatter(file, (ease: number, interval: number, date: Date) => {
									let newEase = ease * 1.2;
									let newInterval = interval * newEase * 1.3;
									return [newEase, newInterval, this.nextReviewDate(newInterval)];
								});
							});
					});
					menu.addItem((item) => {
						item
							.setTitle("Review: 不错 🙂")
							.setIcon("document")
							.onClick(async () => {
								this.updateReviewInFrontMatter(file, (ease: number, interval: number, date: Date) => {
									let newEase = ease;
									let newInterval = interval * newEase;
									return [newEase, newInterval, this.nextReviewDate(newInterval)];
								});
							});
					});
					menu.addItem((item) => {
						item
							.setTitle("Review: 困难 😭")
							.setIcon("document")
							.onClick(async () => {
								this.updateReviewInFrontMatter(file, (ease: number, interval: number, date: Date) => {
									let newEase = ease * 0.85 < 1.3 ? 1.3 : ease * 0.85;
									let newInterval = interval * 0.5 < 1.0 ? 1.0 : interval * 0.5;
									return [newEase, newInterval, this.nextReviewDate(newInterval)];
								});
							});
					});
					menu.addItem((item) => {
						item
							.setTitle("Review: 推迟 ➡️")
							.setIcon("document")
							.onClick(async () => {
								this.updateReviewInFrontMatter(file, (ease: number, interval: number, date: Date) => {
									return [ease, interval, this.nextReviewDate(7.0)];
								});
							});
					});
				}
			})
		);

	}

	onunload() {

	}

	//格式化日期
	dateFormat(fmt: string, date: Date) {
		let ret;
		const opt: { [key: string]: string } = {
			"Y+": date.getFullYear().toString(),        // 年
			"m+": (date.getMonth() + 1).toString(),     // 月
			"d+": date.getDate().toString(),            // 日
			"H+": date.getHours().toString(),           // 时
			"M+": date.getMinutes().toString(),         // 分
			"S+": date.getSeconds().toString()          // 秒
		};
		for (let k in opt) {
			ret = new RegExp("(" + k + ")").exec(fmt);
			if (ret) {
				fmt = fmt.replace(ret[1], (ret[1].length == 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")))
			};
		};
		return fmt;
	}

	// 更新frontmatter中的review属性
	async updateReviewInFrontMatter(file: TFile, foo: Function) {
		// 获得frontmatter
		let frontmatter = this.app.metadataCache.getFileCache(file).frontmatter;
		// 读取文件内容
		let fileText: string = await this.app.vault.read(file);
		// 从frontmatter中读取复习的难易度和复习间隔
		let [originEase, originInterval, originDate] = frontmatter["sr"];
		originDate = new Date(originDate);
		// 更新复习的难易度和复习间隔，easy、good、hard、start over的策略各不相同
		let [destEase, destInterval, destDate] = foo(originEase, originInterval, originDate);
		// 只保留1位小数
		destEase = Number(destEase).toFixed(1);
		destInterval = Number(destInterval).toFixed(1);
		// 格式化时间
		destDate = this.dateFormat("YYYY-mm-dd", destDate);
		// 更新frontmatter
		fileText = fileText.replace(/(\-\-\-[\s\S]+?sr:\s+\[\s*)[\.\d]+\s*,\s*[\.\d]+\s*,\s*\d{4}\-\d{2}\-\d{2}\s*(\][\s\S]+?\-\-\-)/, `$1${destEase},${destInterval},${destDate}$2`);
		// 写入文件
		this.app.vault.modify(file, fileText);
		// 弹出通知
		new Notice(`ease: from ${originEase} to ${destEase}\ninterval: from ${originInterval} to ${destInterval}`);
	}

	// 得到新的下次复习日期
	nextReviewDate(interval: number) {
		let newDate = new Date();
		newDate.setDate(newDate.getDate() + Math.ceil(interval));
		return newDate;
	}

}
