# Obsidian Review Plugin

基于简化了的 `Anki` 算法，安排你的复习笔记的计划

## 安装与使用

### 启用该插件

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

### 编写“待复习笔记一览”文件

该文件会展示出你待复习的笔记列表，以及复习情况的统计

- 为文件的 `front-matter` 添加 `tags` 属性，该属性用于选择欲复习笔记的 `tag` ，即，不在其中的笔记不会被复习
  ```
  ---
  tags: [ CS , 艺术 ]
  ---
  ```

  如果不想过滤，就写成`tags: [ ]`

- 安装 `dataviewjs` 插件，编写 `dataviewjs` 代码
  ```
  // 从文件头读取要筛选的标签
  let tags = dv.current().tags;
  tags = tags.map(b => '#' + b);
  
  // 查询条件
  let condition = '"" and -"template" and -"计划" and -#noreview';
  
  // 将那些标签添加到查询条件中
  if (tags.length != 0) {
    condition += ' and (';
    condition += tags.join(' or ');
    condition += ')';
  }
  
  // 所有笔记的数目
  let sumCount = dv.pages(condition)
    .where(b => b.review)
    .groupBy(b => true)
    .map(b => b.rows.length).values[0];
  
  // 待复习笔记的数目
  let waitForReviewCount = dv.pages(condition)
    .where(b => b.review)
    .where(b => b.review[2] <= dv.date('today'))
    .groupBy(b => true)
    .map(b => b.rows.length).values[0];
  
  if (waitForReviewCount == undefined) {
    waitForReviewCount = 0;
  }
  
  // 展示待复习和所有笔记的数目
  dv.paragraph(`待复习：***${waitForReviewCount}***，所有：***${sumCount}***`)
  
  // 待复习笔记的列表
  dv.table(["File", "date"], dv.pages(condition)
    .where(b => b.review)
    .where(b => b.review[2] <= dv.date('today'))
    .sort(b => b.review[2])
    .limit(17)
    .map(b => [b.file.link, b.review[2]])
  );
  ```
  
- 效果：
  ![image-20220225230246425](assets/image-20220225230246425.png)

## 算法

在 `anki` 的基础上进行简化：

-  `easy` ： `(ease, interval) => [ease * 1.2, interval * newEase * 1.3]` 
-  `good` ： `(ease, interval) => [ease, interval * newEase]` 
-  `hard` ： `(ease, interval) => [ease * 0.85 < 1.3 ? 1.3 : ease * 0.85, interval * 0.5 < 1.0 ? 1.0 : interval * 0.5]` 

另外：

-  微小地扰乱（增加）复习间隔，以避免复习囤积到一天
-  `delay` ：推迟7天复习

