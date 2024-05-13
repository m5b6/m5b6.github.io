import { Client } from "@notionhq/client";

const notion = new Client({
  auth: "secret_VVa8W5mp508KD3OfXpH0HkRV2GWgOBYkIxdGA4nqFqJ",
});

class NotionParser {
  public lastUpdated: string = "?";
  static lastUpdated: any;

  public static async ParseNotion() {
    const elementsToReturn: any[] = [];
    const pageId = "74679b0c46364ed7bda1ee0f20d640f5";
    const pageRoot = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 50,
    });
    const pageElements = pageRoot.results;
    pageElements.forEach((element: any) => {
      console.log(element);

      if (element["type"] === "paragraph") {
        const parsedTime = parseDateTime(element.created_time);

        elementsToReturn.push(
          <div>
            <p>
              <b>{parsedTime}</b>
            </p>
            <p>{element.paragraph.rich_text[0]?.plain_text}</p>
          </div>
        );
      }
    });

    elementsToReturn.sort((a, b) => {
      const aTime = a.props.children[0].props.children;
      const bTime = b.props.children[0].props.children;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    elementsToReturn.reverse();

    this.lastUpdated = elementsToReturn[0].props.children[0].props.children;

    console.log(elementsToReturn);

    return elementsToReturn;
  }
}

const parseDateTime = (date: string) => {
  const dateObj = new Date(date);
  const options: any = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return dateObj.toLocaleString("en-GB", options);
};

export default NotionParser;
