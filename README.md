# Obsidian Review Plugin

基于简化了的 `Anki` 算法，安排你的复习笔记的计划

## 安装与使用

### 启用该插件

- `npm run build`

- 复制 `manifest.json`, `main.js` 到`your-vault/.obsidian/plugins/obsidian-review`下

- 打开 `obsidian` ，启用 `review` 插件

- 效果如下：

  ![image-20220225225956597](assets/image-20220225225956597.png)

### 编写template文件

- 安装 `templater-obsidian` 插件

- 编写 `template` 文件，至少包含以下语句：
  ```
  ---
  tags: []
  review: [2.5, 1.0, <% tp.file.creation_date('YYYY-MM-DD') %>]
  ---
  ```
  
- 其中 `review[0]` 表示初始熟悉度， `review[1]` 表示初始复习间隔， `review[2]` 表示下次复习时间

- 应用该 `template` 于你想要复习的文件，**否则无法正常使用 `review` 插件**

### 编写review.md

该文件会展示出你待复习的笔记列表，以及复习情况的统计，注意该文件名称必须叫做review.md

安装 `dataviewjs` 插件，编写 `dataviewjs` 代码

```dataviewjs
// 基础过滤得到的笔记
let basicNotes = dv
  .pages('"" and -"assets"')
  .where(b => b.sr);

// 待复习的笔记
let toBeReviewedNotes = basicNotes
  .where(b => b.sr[2] <= dv.date('today'));

// 今日复习的笔记
let todayReviewedNotes = basicNotes
  .where(b => b.ctime - 0 != dv.date('today') || b.sr[2] - 0 != dv.date('tomorrow')) // 不是今天创建的笔记
  .where(b => b.sr[2] == dv.duration(`${Math.ceil(b.sr[1])}day`) + dv.date('today'));

// 待复习笔记的数目
let waitReviewCount = toBeReviewedNotes
  .values
  .reduce((sum, b) => sum + 1, 0);

// 今日复习的笔记的数目
let todayReviewedCount = todayReviewedNotes
  .values
  .reduce((sum, b) => sum + 1, 0);

// 今日复习的笔记的大小（KB）
let todayReviewedSize = (todayReviewedNotes
  .values
  .reduce((sum, b) => sum + b.file.size, 0) / 1024).toFixed(0);

let paragraph = dv.paragraph(`➤ **<code>NOTE</code>** ➤ **<code>${waitReviewCount} + ${todayReviewedCount} | ${todayReviewedSize}KB</code>**`);

let showSurprise = false;
paragraph.addEventListener("click", (evt) => {
    if (!showSurprise) {
        paragraph.innerHTML += " <b><code>Surprise ヽ(´▽`)/</code></b>";
        showSurprise = true;
    }
});

// 待复习笔记的列表
dv.table(["Pending Notes", "size"], toBeReviewedNotes
  .sort(b => b.sr[2])
  .limit(10)
  .map(b => [b.file.link, (b.file.size / 1024).toFixed(1)])
);
```

效果如下：

![image-20240317211813759](assets/image-20240317211813759.png)

## 算法

在 `anki` 的基础上进行简化：

-  `easy` ： `(ease, interval) => [ease * 1.2, interval * newEase * 1.3]` 
-  `good` ： `(ease, interval) => [ease, interval * newEase]` 
-  `hard` ： `(ease, interval) => [ease * 0.85 < 1.3 ? 1.3 : ease * 0.85, interval * 0.5 < 1.0 ? 1.0 : interval * 0.5]` 
-  `delay` ：推迟7天复习


## 日历

附赠一个日历插件，支持循环事件（懒得新建仓库了）：

```JavaScript
// loopWeeks: 例如[1, 3, 7]，表示每周1、周3、周7
// loopMonths: 例如[1, 7, 31]，表示每月的1号、7号、31号
// loopMonths2: 例如[[2, 6], [-2, 7]]，表示每月第2个周六和倒数第2个周日
// loopYears: 例如[[1, 31], [3, 2]]，表示每年1月31日和3月2日
// startTime: 开始时分，例如12:00，如果为空表示全天事件
// endTime: 结束时分，例如13:00

let { DateTime } = dv.luxon;
let today = DateTime.local().startOf('day');
let oneWeekLater = today.plus({ days: 7 });
let events = [];
function isNotNullOrEmptyArray(variable) {
    return (
        variable !== null &&
        variable !== undefined &&
        Array.isArray(variable) &&
        variable.length > 0
    );
}
function nextMonth(year, month) {
    month++;
    if (month > 12) {
        year++;
        month = 1;
    }
    return [year, month];
}
function pushEvent(p, date) {
    events.push({
        title: p.file.link,
        date: date,
        startTime: p.startTime,
        endTime: p.endTime,
    });
}
function pushError(p, msg) {
    events.push({ title: p.file.link, date: today, startTime: "", endTime: msg });
}
dv.pages('"计划/loop"').forEach((p) => {
    try {
        if (isNotNullOrEmptyArray(p.loopWeeks)) {
            p.loopWeeks.forEach((weekDay) => {
                if (weekDay < 1 || weekDay > 7) {
                    throw new Error("Invalid weekday value");
                }
                let dayOffset = weekDay - today.weekday;
                if (dayOffset < 0) dayOffset += 7;
                while (true) {
                    let nextOccurrence = today.plus({ days: dayOffset });
                    dayOffset += 7;
                    if (nextOccurrence <= oneWeekLater) {
                        pushEvent(p, nextOccurrence);
                    } else {
                        break;
                    }
                }
            });
        } else if (isNotNullOrEmptyArray(p.loopMonths)) {
            p.loopMonths.forEach((day) => {
                if (day < 1 || day > 31) {
                    throw new Error("Invalid day value");
                }
                let nextOccurrence;
                let year = today.year;
                let month = today.month;
                while (true) {
                    nextOccurrence = DateTime.fromObject({
                        year: year,
                        month: month,
                        day: day,
                    });
                    if (!nextOccurrence.isValid || nextOccurrence < today) {
                        [year, month] = nextMonth(year, month);
                    } else if (nextOccurrence <= oneWeekLater) {
                        pushEvent(p, nextOccurrence);
                        [year, month] = nextMonth(year, month);
                    } else {
                        break;
                    }
                }
            });
        } else if (isNotNullOrEmptyArray(p.loopMonths2)) {
            p.loopMonths2.forEach(([week, weekday]) => {
                if (week < -5 || week > 5 || weekday < 1 || weekday > 7) {
                    throw new Error("Invalid week or weekday value");
                }
                let nextOccurrence;
                let month = today.month;
                let year = today.year;
                while (true) {
                    if (week > 0) {
                        let firstDayOfTheMonth = DateTime.fromObject({
                            year: year,
                            month: month,
                            day: 1,
                        });
                        let dayOffset = weekday - firstDayOfTheMonth.weekday;
                        if (dayOffset < 0) dayOffset += 7;
                        nextOccurrence = firstDayOfTheMonth
                            .plus({ days: dayOffset })
                            .plus({ weeks: week - 1 });
                    } else {
                        let [yearOfNextMonth, monthOfNextMonth] = nextMonth(year, month);
                        let lastDayOfTheMonth = DateTime.fromObject({
                            year: yearOfNextMonth,
                            month: monthOfNextMonth,
                            day: 1,
                        }).minus({ days: 1 });
                        let dayOffset = weekday - lastDayOfTheMonth.weekday;
                        if (dayOffset > 0) dayOffset -= 7;
                        nextOccurrence = lastDayOfTheMonth
                            .plus({ days: dayOffset })
                            .plus({ weeks: week + 1 });
                    }
                    if (nextOccurrence < today || nextOccurrence.month !== month) {
                        [year, month] = nextMonth(year, month);
                    } else if (nextOccurrence <= oneWeekLater) {
                        [year, month] = nextMonth(year, month);
                        pushEvent(p, nextOccurrence);
                    } else {
                        break;
                    }
                }
            });
        } else if (isNotNullOrEmptyArray(p.loopYears)) {
            p.loopYears.forEach(([month, day]) => {
                let year = today.year;
                while (true) {
                    let nextOccurrence = DateTime.fromObject({
                        year: year,
                        month: month,
                        day: day,
                    });
                    if (year > oneWeekLater.year) {
                        break;
                    }
                    if (!nextOccurrence.isValid || nextOccurrence < today) {
                        year++;
                    } else if (nextOccurrence <= oneWeekLater) {
                        pushEvent(p, nextOccurrence);
                        year++;
                    } else {
                        break;
                    }
                }
                
            });
        }
    } catch (error) {
        pushError(p, error.message);
    }
});
events.sort((a, b) => {
    let dateDiff = a.date - b.date;
    if (dateDiff !== 0) return dateDiff;
    if (a.startTime != null && b.startTime != null) {
        let timeDiff = a.startTime.localeCompare(b.startTime);
        if (timeDiff !== 0) return timeDiff;
    }
    let aEndTime = a.endTime || "23:59";
    let bEndTime = b.endTime || "23:59";
    return aEndTime.localeCompare(bEndTime);
});
dv.table(
    ["", ""],
    events.map((e) => [
        e.title,
        `<code>${e.date.toFormat("yyyy-MM-dd")} ${e.startTime || ""}->${e.endTime || ""
        }</code>`,
    ])
);
```