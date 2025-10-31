"use client";
import "./template1.scss";

const Template1 = ({ banner, title, content }: any) => {
  return (
    <div className="static-page">
      <div className="template1">
        <div
          className="banner"
          style={{ backgroundImage: `url(${banner || "/whoweareBg.png"})` }}
        >
          <div className="container 2xl mx-auto">
            <h1>{title}</h1>
          </div>
        </div>
        <div className="container 2xl mx-auto">
          <div className="content_block">
            {/* <h1>{title}</h1> */}
            <div dangerouslySetInnerHTML={{ __html: content }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Template1;
