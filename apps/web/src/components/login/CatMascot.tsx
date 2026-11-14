export function CatMascot() {
  return (
    <div className="cat-scene" aria-hidden="true">
      <span className="cat-glow" />
      <div className="cat">
        <div className="cat-body">
          <span className="cat-paw cat-paw-left" />
          <span className="cat-paw cat-paw-right" />
          <span className="cat-tail" />
        </div>
        <span className="cat-ear cat-ear-left">
          <span className="cat-ear-inner" />
        </span>
        <span className="cat-ear cat-ear-right">
          <span className="cat-ear-inner" />
        </span>
        <div className="cat-head">
          <span className="cat-stripe cat-stripe-left" />
          <span className="cat-stripe cat-stripe-right" />
          <span className="cat-eye cat-eye-left" />
          <span className="cat-eye cat-eye-right" />
          <span className="cat-cheek cat-cheek-left" />
          <span className="cat-cheek cat-cheek-right" />
          <span className="cat-nose" />
          <span className="cat-mouth cat-mouth-left" />
          <span className="cat-mouth cat-mouth-right" />
          <span className="cat-whisker cat-whisker-left cat-whisker-1" />
          <span className="cat-whisker cat-whisker-left cat-whisker-2" />
          <span className="cat-whisker cat-whisker-left cat-whisker-3" />
          <span className="cat-whisker cat-whisker-right cat-whisker-1" />
          <span className="cat-whisker cat-whisker-right cat-whisker-2" />
          <span className="cat-whisker cat-whisker-right cat-whisker-3" />
        </div>
      </div>
    </div>
  );
}

export default CatMascot;
