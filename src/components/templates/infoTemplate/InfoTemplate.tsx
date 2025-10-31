import { Image } from "antd";
import "./InfoTemplate.scss";

type InfoTemplateProps = {
  imageSize?: "medium" | "large" | "small";
  imageUrl: string;
  pageTitle: string;
  pageContent: string;
};

const InfoTemplate = ({
  imageSize = "large",
  imageUrl,
  pageTitle,
  pageContent,
}: InfoTemplateProps) => {
  return (
    <div className="container 2xl mx-auto ">
      <div className="static-page">
        <h1>{pageTitle}</h1>
        <div
          style={{
            float: "left",
            marginRight: "20px",
            width:
              imageSize == "small"
                ? "15%"
                : imageSize == "medium"
                ? "25%"
                : imageSize == "large"
                ? "48%"
                : "48%",
          }}
        >
          <Image src={imageUrl} />
        </div>
        <div dangerouslySetInnerHTML={{ __html: pageContent }} />
      </div>
    </div>
  );
};

export default InfoTemplate;
