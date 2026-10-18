<?
//print_r($_GET);
$path=$_GET['path'];
$file=$_GET['file'];
$no   =$_GET['no'];
//echo "path[$path]";
//echo '<br>';
//echo "file[$file]";
//echo '<br>';
//echo "d[$d]";
$path = str_replace('&', '\\&', $path);
$lfile = str_replace('&', '\\&', $file);
//$lfile = str_replace('#', '\\#', $file);

$now_timestamp = time();
//$file='';
//shell_exec("cp -r $src $dest");
if($file){ // 파일이 있으면 zip 파일 생성
    //echo 'create';
    //echo "cp $path$file* ocplay";
    shell_exec("cp $path$lfile* ocplay");

    $batfile = fopen("ocplay/play.bat", "w") or die("Unable to open file!");
    //$txt = "OCPLAY ${file}.IMS\n";
    $txt = "cd ocplay\nmouseoff.com\nOCPLAY ${file}.IMS STANDARD.BNK\nhyunee";
    fwrite($batfile, $txt);
    fclose($batfile);
    //sleep(1);

//    shell_exec("rm zip/ocplay.zip -f");
    //shell_exec("zip -r zip/ocplay ocplay");
    shell_exec("rm zip/ocplay.$now_timestamp.zip -f");
    shell_exec("zip -r zip/ocplay.$now_timestamp.zip ocplay");
    //sleep(1);

    shell_exec("rm ocplay/play.bat ocplay/${file}* -f");
    echo 'ocplay.'.$now_timestamp;
}

if($no){ // 번호가 있으면 zip 파일 삭제
    //echo 'erase';
    //echo $now_timestamp;

    shell_exec("rm zip/ocplay.$no.zip -f");
}
?>