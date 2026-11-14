export function CatMascot() {
  return (
    <div className="cat-scene" aria-hidden="true">
      <span className="cat-glow" />
      <span className="cat-shadow" />
      <div className="cat">
        <div className="cat-body">
          <span className="cat-arm cat-arm-left" />
          <span className="cat-arm cat-arm-right" />
          <span className="cat-tail" />
        </div>
        <span className="cat-ear cat-ear-left">
          <span className="cat-ear-inner" />
        </span>
        <span className="cat-ear cat-ear-right">
          <span className="cat-ear-inner" />
        </span>
        <div className="cat-head">
          <div className="cat-eye cat-eye-left">
            <span className="cat-pupil" />
            <span className="cat-sparkle" />
          </div>
          <div className="cat-eye cat-eye-right">
            <span className="cat-pupil" />
            <span className="cat-sparkle" />
          </div>
          <span className="cat-nose" />
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
