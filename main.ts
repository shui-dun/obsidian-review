import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, FrontMatterCache, addIcon } from 'obsidian';

export default class MyPlugin extends Plugin {

	async onload() {
		addIcon("review-easy", `<circle cx="50" cy="50" r="40" fill="none" stroke="grey" stroke-width="19" />`);
		addIcon("review-good", `<circle cx="50" cy="50" r="40" fill="none" stroke="grey" stroke-width="16" />`);
		addIcon("review-hard", `<circle cx="50" cy="50" r="40" fill="none" stroke="grey" stroke-width="13" />`);
		addIcon("review-start-over", `<circle cx="50" cy="50" r="40" fill="none" stroke="grey" stroke-width="10" />`);


		this.addRibbonIcon("review-easy", "Review: 容易 😁", async () => {
			await this.updateReviewInFrontMatterOfCurrentFile((ease: number, interval: number, date: Date) => {
				let newEase = ease * 1.2;
				let newInterval = interval * newEase * 1.3;
				return [newEase, newInterval, this.nextReviewDate(newInterval)];
			});
			await this.jumpToReviewList();
		});

		this.addRibbonIcon("review-good", "Review: 不错 🙂", async () => {
			await this.updateReviewInFrontMatterOfCurrentFile((ease: number, interval: number, date: Date) => {
				let newEase = ease;
				let newInterval = interval * newEase;
				return [newEase, newInterval, this.nextReviewDate(newInterval)];
			});
			await this.jumpToReviewList();
		});

		this.addRibbonIcon("review-hard", "Review: 困难 😭", async () => {
			await this.updateReviewInFrontMatterOfCurrentFile((ease: number, interval: number, date: Date) => {
				let newEase = ease * 0.85 < 1.3 ? 1.3 : ease * 0.85;
				let newInterval = interval * 0.5 < 1.0 ? 1.0 : interval * 0.5;
				return [newEase, newInterval, this.nextReviewDate(newInterval)];
			});
			await this.jumpToReviewList();
		});

		this.addRibbonIcon("review-start-over", "Review: 推迟 ➡️", async () => {
			await this.updateReviewInFrontMatterOfCurrentFile((ease: number, interval: number, date: Date) => {
				return [ease, interval, this.nextReviewDate(7.0)];
			});
			await this.jumpToReviewList();
		});
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

	async updateReviewInFrontMatterOfCurrentFile(foo: Function) {
		let file = this.app.workspace.getActiveFile();
		if (!file) {
			console.error("obsidian-review: No active file to update review.");
			return;
		}
		await this.updateReviewInFrontMatter(file, foo);
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
		// 修复有时候当天复习笔记却显示为下一天复习的笔记的bug：
		// 只保留1位小数，以与updateReviewInFrontMatter中的destEase = Number(destEase).toFixed(1);相一致
		// 例如，7.01在此时应该先被转化为7.0，否则Math.ceil(interval)会向上取整为8而非7
		interval = parseFloat(Number(interval).toFixed(1));
		let newDate = new Date();
		newDate.setDate(newDate.getDate() + Math.ceil(interval));
		return newDate;
	}

	// 跳转到文件复习列表
	async jumpToReviewList() {
		let previousFilePath = this.app.workspace.getLastOpenFiles()[0];
		// 如果上一个文件名不包含“review.md” 或者 “note.md”，则返回
		if (!previousFilePath.includes("review.md") && !previousFilePath.includes("note.md")) {
			new Notice("Jump Disabled", 500);
			return;
		}
		// 等待一段时间使得索引更新，不然跳转回文件复习列表之后文件复习列表还是旧的
		await new Promise(resolve => setTimeout(resolve, 200));
		let previousFile = this.app.vault.getAbstractFileByPath(previousFilePath);
		if (!(previousFile instanceof TFile)) {
			console.error("obsidian-review: The last opened file is not found or not a TFile.");
			return;
		}
		// 获取当前活动的leaf（leaf是指标签页）
		let activeLeaf = this.app.workspace.activeLeaf;
		if (!activeLeaf) {
			console.error("obsidian-review: No active leaf to open the file in.");
			return;
		}
		await activeLeaf.openFile(previousFile);
	}
}
