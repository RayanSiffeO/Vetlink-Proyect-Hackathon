export function CatMascot() {
  return (
    <article className="css-cat" role="img" aria-labelledby="cat-alt">
      <div id="cat-alt" className="cat-alt">
        Cartoon de un gato negro tierno dibujado en CSS
      </div>
      <div className="shadow" />
      <div className="tail" />
      <div className="body">
        <div className="leg" />
        <div className="leg" />
        <div className="paw" />
        <div className="paw" />
      </div>
      <div className="head">
        <div className="ear" />
        <div className="ear" />
        <div className="face">
          <div className="whisker" />
          <div className="whisker" />
          <div className="whisker" />
          <div className="whisker" />
          <div className="eye" />
          <div className="eye" />
          <div className="nose" />
        </div>
      </div>
    </article>
  );
}

export default CatMascot;
